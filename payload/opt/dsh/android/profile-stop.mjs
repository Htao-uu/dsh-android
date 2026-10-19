// profile-stop.mjs — exit the harness after a fixed window when profiling.
//
// Loaded with `node --import file:///opt/dsh/android/profile-stop.mjs` only
// when /sdcard/dsh-cpuprof exists (see start-dsh.sh). process.exit() flushes the
// V8 CPU profile; a kill from outside would not.
setTimeout(() => process.exit(0), 26000);
