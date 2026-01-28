# The Story Behind Monocrate: Building in Public from a 110-Package Monorepo

We have 110 packages in our monorepo. When I refactor a core utility, I update 40 packages in one commit. Type checking runs across the entire codebase. Tests verify every integration. It's glorious.

Then one day we decided to open source one package.

Six hours later, three engineers sitting around a screen, we gave up and kept it internal.

That's the day Monocrate started.

## The Monorepo Advantage

Let me tell you what it's like working in a 110-package monorepo with over 100,000 lines of code.

Everything is in one place. When I need to add a feature to our API client, I can update the server package, the client package, the CLI that uses both, and the documentation package all in one PR. One atomic commit. One build. One test run that verifies everything still works together.

Internal dependencies just work. I write `import { formatDate } from '@myorg/utils'` and my editor shows me the types immediately. No "let me check if that API is still valid" because you're on version 2.1 but the docs are for 2.3. No npm install dance. No praying that semantic versioning will save you.

When we find a bug in our validation logic, we fix it once in `@myorg/validators`. The fix automatically propagates to the 23 packages that depend on it. We run the tests. If anything breaks, we fix it right there. No cascading releases. No "wait for the fix to be published, then update 23 package.json files, then publish those."

Refactoring across package boundaries? Easy. Grep shows me every usage. Change them all. Run tests. Commit. Done.

This is how we ship features in days instead of weeks. The monorepo is our competitive advantage.

## The Day Everything Broke

We built a neat little TypeScript library for JSON schema validation. It was elegant. Fast. Well-tested. We'd been using it internally for six months.

"We should open source this," someone said in standup. Everyone nodded. It was genuinely useful. Why keep it locked in our private repo?

So I started the process. How hard could it be?

Our validation library lived at `packages/validators`. It depended on `@myorg/utils` for some string helpers and `@myorg/core` for error handling. Standard internal dependencies. In our monorepo, this just worked.

I ran `npm publish` from the validators directory.

```
npm ERR! code E404
npm ERR! 404 Not Found - GET https://registry.npmjs.org/@myorg%2futils
npm ERR! 404 '@myorg/utils@^1.2.0' is not in this registry.
```

Right. npm doesn't know what `@myorg/utils` is. It's not published. It's just sitting in `packages/utils`, two directories over.

"Let's publish utils too then," I said.

But utils depended on core. And core depended on config. And config depended on... you get it. To publish one package, I'd need to publish 12 packages. Most of them were internal utilities nobody asked for. `@myorg/string-case-converters`. `@myorg/really-just-four-functions`.

Plus, we'd have to maintain them. Version them. Write documentation. Handle issues. Coordinate releases. A breaking change in core means bumping versions across 12 packages.

This was supposed to take an hour. It was becoming a project.

## First Attempt: Bundle It

"What if we just bundle everything?" someone suggested.

Worth a shot. I added webpack to the validators package. Configured it to bundle all dependencies. Ran it. Got a single `dist/bundle.js` file. Self-contained. No external dependencies on `@myorg/*` packages.

Perfect. Pushed to npm.

Two days later, an issue was filed: "Stack traces are unreadable."

```javascript
Error: Validation failed
    at bundle.js:3247
    at bundle.js:1892
    at Object.<anonymous> (bundle.js:4501)
```

The user couldn't tell where the error came from. Neither could we. The webpack bundle had merged everything into one file. Our carefully organized 15 modules became 5,000 lines of transformed code. Finding `bundle.js:3247` meant searching through generated output.

Then the TypeScript users complained. The type declarations didn't match the bundled code. We'd published the original `.d.ts` files, but they referenced modules that no longer existed. TypeScript's type checker was confused. Autocomplete broke. Type errors appeared in weird places.

Then someone tried to tree-shake our library. Modern bundlers can eliminate unused code if you give them ES modules. But we'd already bundled everything. To them, our package was an opaque blob. They wanted one validation function. They got the entire library.

We'd solved the dependency problem by creating three new problems.

## Second Attempt: Manual Copying

"Maybe we're overthinking this," I said. "What if we just copy the files?"

So I did. Manually copied everything from `packages/utils` into `packages/validators/vendor/utils`. Then `packages/core` into `packages/validators/vendor/core`.

Then I started fixing imports:

```typescript
// Before
import { formatDate } from '@myorg/utils'

// After
import { formatDate } from './vendor/utils/dist/index.js'
```

Forty-seven imports to update. I spent 20 minutes carefully finding and replacing each one. Checked that paths were correct. Ran tests locally. Everything worked.

Pushed to npm. Felt good about it.

Three hours later, production was down. A customer was hitting errors in their deployment.

Turns out I'd missed three imports. They were buried in files I hadn't tested directly. The package worked in development because Node's module resolution found `@myorg/utils` through the workspace configuration. But on npm, without the monorepo workspace, those three imports failed.

Manual copying works right up until you forget one file. One import. Then your package breaks in production.

And even when it worked, it was tedious. Every release meant copying files, updating paths, checking that nothing was missed. I was spending 30 minutes on packaging instead of 30 seconds on coding.

## The Regex Incident

"We can automate this," I thought. "Just write a script."

I spent an afternoon building a Node script that would:
1. Find all packages we depended on
2. Copy their files into a vendor directory
3. Regex through all the source files and rewrite imports

The regex approach looked promising:

```javascript
const importRegex = /from ['"]@myorg\/([^'"]+)['"]/g
const newImport = `from './vendor/$1/dist/index.js'`
```

Worked great for simple imports. Then someone's code had this:

```typescript
import {
  validateEmail,
  validatePhone
} from '@myorg/validators'
```

Multiline import. My regex didn't match it. Script skipped it. Package broke in production again.

I fixed the regex. Made it handle multiline. Then someone used a dynamic import:

```typescript
const validators = await import('@myorg/validators')
```

New regex. Then someone imported a subpath:

```typescript
import { formatDate } from '@myorg/utils/dates'
```

That's not `dist/index.js`. That's whatever the `exports` field maps `./dates` to. Could be `dist/dates.js`. Could be `dist/dates/index.js`. Could be anything.

I was building an AST parser with regex. This was going nowhere.

## The Realization

After two weeks of failed attempts, I sat down with coffee and actually thought about what we needed.

We don't need a bundler. Bundlers solve a different problem. They optimize code for browsers. Minify. Split chunks. Tree-shake. We don't need any of that. We're publishing a Node.js library.

We don't need to publish everything as separate packages. That creates maintenance overhead we explicitly want to avoid.

What we need is simpler: smart file copying.

The requirements became clear:

1. **Copy files from internal dependencies** - If our package depends on `@myorg/utils`, copy utils' files into the output
2. **Rewrite imports** - Change `@myorg/utils` to a relative path to wherever we copied the files
3. **Preserve module structure** - Don't bundle. Don't flatten. Keep each file as a separate file
4. **Handle type declarations** - Rewrite imports in `.d.ts` files the same way
5. **Merge dependencies** - Create a `package.json` with all the third-party deps from all included packages

This isn't rocket science. It's file operations you could do by hand. But automated.

## Building Monocrate

I started with a 200-line bash script. It mostly worked. Then I tried to rewrite imports and remembered why I'd failed with regex.

The problem: JavaScript imports are syntactically complex. You can't reliably parse them with regex. You need an actual parser. An Abstract Syntax Tree.

I found ts-morph. It's a wrapper around TypeScript's compiler that lets you read and modify source files programmatically. Instead of regex, you parse the file into an AST, find the import nodes, check their specifiers, and rewrite them.

Here's what that looks like conceptually:

```typescript
const sourceFile = project.addSourceFileAtPath('dist/index.js')

for (const importDecl of sourceFile.getImportDeclarations()) {
  const specifier = importDecl.getModuleSpecifierValue()

  if (specifier.startsWith('@myorg/')) {
    // This is an internal import. Rewrite it.
    const newPath = calculateRelativePath(currentFile, targetPackage)
    importDecl.setModuleSpecifier(newPath)
  }
}

await sourceFile.save()
```

It handles every import form. Static imports. Re-exports. Dynamic imports. Default imports. Named imports. Namespace imports. Doesn't matter. The AST knows what it is.

The next problem: which file does `@myorg/utils` point to?

In Node.js, package resolution uses the `exports` field in package.json:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./dates": "./dist/dates.js"
  }
}
```

So `import x from '@myorg/utils'` resolves to `dist/index.js`, but `import x from '@myorg/utils/dates'` resolves to `dist/dates.js`.

I found resolve.exports. It implements Node's resolution algorithm. You give it an exports field and a subpath, it tells you which file.

Now I could:
1. Parse the import: `@myorg/utils/dates`
2. Find the package: `@myorg/utils`
3. Resolve the subpath using exports: `dist/dates.js`
4. Calculate the relative path from the current file to that target
5. Rewrite the import

The last piece: which files to copy?

I could hardcode "copy dist/". But different packages structure their output differently. Some use `lib/`. Some use `build/`. Some have carefully configured the `files` field in package.json to exclude test files.

The answer was obvious: use `npm pack`.

When you run `npm pack`, it creates a tarball of exactly what `npm publish` would upload. It respects the `files` field, `.npmignore`, everything. So I ran `npm pack --dry-run` for each package, parsed the file list, and copied exactly those files.

Now the tool does what npm would do. If your package is configured to exclude tests, Monocrate excludes them. No extra configuration.

## Design Philosophy

As Monocrate took shape, a few principles emerged:

**No magic.** Everything Monocrate does, you could do by hand. It's just automated. Copy files. Rewrite imports. That's it.

**Use existing tools.** Don't reimplement npm's packing logic. Don't reimplement Node's module resolution. Use `npm pack`. Use resolve.exports. Stand on the shoulders of giants.

**Preserve structure.** Don't bundle. Don't flatten. Don't transform. Your monorepo structure is how you think about your code. Don't lose that when you publish.

**Fail loudly.** If two packages require different versions of the same dependency, don't guess. Report an error. Let the user fix it.

**One command.** No configuration files. No multi-step process. Point at a package. Done.

These aren't just nice-to-haves. They're load-bearing. The moment you add "smart" bundling logic, you're maintaining a bundler. The moment you add custom resolution, you're maintaining a resolver. The moment you add configuration, you're maintaining a config system.

Monocrate does one thing: copy files and rewrite imports. That's a small surface area. Easy to understand. Easy to maintain.

## What We Learned

Building Monocrate taught me a few things about tool design.

**Start with the problem, not the solution.** We tried bundlers because everyone uses bundlers. But bundlers weren't built for this use case. They solve a different problem. Starting from "what do we actually need" led to a simpler solution.

**Constraints are features.** Monocrate doesn't bundle. It doesn't minify. It doesn't tree-shake. These aren't missing features. They're design decisions. By not doing those things, we keep the tool simple and focused.

**Leverage the platform.** Instead of building custom logic, use npm's own tools. `npm pack` tells us which files to copy. ts-morph parses imports. resolve.exports handles module resolution. We're just gluing together existing pieces.

**Real-world usage finds the edge cases.** I thought I understood import rewriting until we hit dynamic imports. And re-exports. And packages with complex exports fields. And TypeScript declaration files. Each one revealed something I hadn't considered.

## The Results

We've now published eight packages from our monorepo using Monocrate. The workflow went from a half-day careful process to 30 seconds:

```bash
monocrate publish packages/my-package --bump patch
```

Publishing time dropped from hours to seconds. Packaging bugs went to zero. We stopped worrying about whether splitting a package would make publishing painful.

The surprising benefit: we're more willing to share our work now. Before, open sourcing something required a cost-benefit analysis. "Is this useful enough to justify the packaging pain?" Now it's just "run monocrate."

We've open sourced four utility libraries that were trapped in our monorepo. Not because they weren't useful. Because getting them out was friction.

Monocrate removed the friction.

## Try It

If you're in a monorepo and you want to publish one package without publishing everything, Monocrate might help:

```bash
npm install -g monocrate
monocrate publish packages/your-package --bump patch
```

It's open source: [github.com/imaman/monocrate](https://github.com/imaman/monocrate)

The philosophy is simple: monorepos for internal speed, Monocrate for external sharing. Best of both worlds.

Your monorepo structure is how you think about your code. You shouldn't lose that when you publish.

## Looking Forward

Monocrate solves our problem. But there's more to do.

The `--mirror-to` flag lets you mirror source files to a separate public repo alongside publishing. We use this to keep our open source packages in a public repo while developing in our private monorepo. It works, but it's basic.

Error messages could be better. When import rewriting fails, the error should tell you exactly which import in which file is broken and why.

Performance could improve for huge monorepos. We have 110 packages and it's fast enough. But someone will have 500 packages and wonder why it's slow.

Documentation could cover more edge cases. The common path is documented well. The weird stuff still requires reading the code.

If any of this interests you, contributions are welcome. The codebase is small. Five main classes. You can understand it in 10 minutes.

## The Philosophy

Here's what I believe after building this:

Tools should be simple enough to understand quickly. If your tool needs three pages of configuration, it's too complex.

Module boundaries matter. They're not just organizational. They're how you think about your code. Preserve them.

Monorepos are about speed. You should be able to refactor across 40 packages in one commit. You should be able to update an internal API and see every usage immediately. You should be able to run one test suite that verifies everything works together.

But that doesn't mean you can't share your work. Open source shouldn't require re-architecting your entire development workflow.

Monocrate is about having both. Move fast internally. Share externally. Don't compromise either.

That's the story. A 110-package monorepo, a six-hour failed attempt at publishing, and a tool that does exactly one thing: smart file copying.

If you've fought with publishing from a monorepo, try Monocrate. If you have ideas for making it better, open an issue. If you have war stories, I want to hear them.

The monorepo publishing problem is solvable. We just needed the right tool.
