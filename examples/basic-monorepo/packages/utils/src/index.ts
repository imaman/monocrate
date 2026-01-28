export function formatMessage(msg: string): string {
  return `[${new Date().toISOString()}] ${msg}`
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
