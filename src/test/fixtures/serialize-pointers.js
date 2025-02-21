#!/usr/bin/env node --disable-warning=ExperimentalWarning --experimental-strip-types
import fs from 'node:fs'
import * as concordance from '../../exports.ts'
import { binFile, tree } from './pointer-serialization.ts'

fs.writeFileSync(binFile, concordance.serialize(concordance.describe(tree)))
