#!/usr/bin/env node
import { formatMessage, capitalize } from '@example/utils'

const message = process.argv[2] || 'hello world'
console.log(formatMessage(capitalize(message)))
