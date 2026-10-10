# Task: reverse engineer an unknown program

Use the c64-field-debug skill for notes during this task. Write a `thought` note after each step.

The file is `field-test/target/<FILE>`. The tester puts a `.prg` or a `.d64` there before the session, and writes its name here.

Steps:

1. Find out what the file is: a disk image or a program. Find its load address. Find out whether it starts with a BASIC line, and whether it is packed.
2. If it is packed, get the unpacked program from the emulator.
3. Run a first static analysis with DXA, then a deeper one with Ghidra, into project knowledge. Report the conflicts.
4. Run the program in the emulator. Find the main loop and the routine that draws the screen. Use breakpoints, the CPU history and the profiler. Name both in project knowledge.
5. Take three addresses that the program writes often. Explain what each one means on the platform.
6. Reconstruct one small routine as ACME source. Assemble it. Show with a c64-testing A/B scenario that the rebuilt routine behaves the same as the original.
