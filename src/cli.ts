#!/usr/bin/env node
import * as path from "path";
import minimist from "minimist";
import { check } from "./index";

const {
  workspace = "./",
  srcDir = "",
  onlyTemplate = false,
  onlyTypeScript = true,
  excludeDir = [],
  verbose = false,
  _: explicitTargetFiles = [],
} = minimist(process.argv.slice(2), {
  alias: {
    onlyTypeScript: ["ts", "typescript", "Typescript", "onlyTypescript", "onlyTs", "only-ts", "only-typescript"],
    onlyTemplate: ["template", "Template", "only-template"],
    verbose: ["v"],
  }
});

const cwd = process.cwd();
const _workspace = path.resolve(cwd, workspace);

check({
  workspace: _workspace,
  srcDir: path.resolve(_workspace, srcDir),
  onlyTemplate: Boolean(onlyTemplate),
  onlyTypeScript: Boolean(onlyTypeScript),
  excludeDirs: typeof excludeDir === "string" ? [excludeDir] : excludeDir,
  explicitTargetFiles,
  verbose,
});
