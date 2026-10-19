#!/usr/bin/env node
/**
 * boot-prep.mjs — one Node process for both boot-time repairs.
 *
 * start-dsh.sh used to run repair-dsh.mjs and repair-profile.mjs as two
 * separate node processes. Each one pays V8 startup, the module graph and the
 * PRoot syscall cost before the harness may even begin; on the phone a Node
 * start is ~0.2 s, so this halves that part of the boot.
 *
 * The two scripts are still the source of truth and still runnable on their
 * own (their CLI defaults are untouched). This file only sets process.argv to
 * the shape each one expects and imports them in order, so their top-level
 * code runs exactly once in this process.
 *
 * Usage:
 *   node boot-prep.mjs [node_modules] [seed-dir] [home-dir]
 * defaults: /opt/dsh/node_modules /opt/dsh/dsh-home-seed $DSH_HOME|$HOME|/root
 */
const argv = process.argv.slice();
const nodeModules = argv[2] ?? "/opt/dsh/node_modules";
const seed = argv[3] ?? "/opt/dsh/dsh-home-seed";
const home = argv[4] ?? process.env.DSH_HOME ?? process.env.HOME ?? "/root";

// repair-dsh.mjs reads process.argv[2] as the node_modules root.
process.argv = [argv[0], argv[1], nodeModules];
await import("./repair-dsh.mjs");

// repair-profile.mjs reads process.argv[2]=seed, process.argv[3]=home.
process.argv = [argv[0], argv[1], seed, home];
await import("./repair-profile.mjs");
