# Task: build, run, debug and test a new program

Use the c64-field-debug skill for notes during this task. Write a `thought` note after each step.

The program is in 6502 assembly for ACME. It must:

- clear the screen,
- print the text `HELLO FROM C64` at the top left, in white on black,
- change the border color once per frame, in a raster interrupt at raster line 100, through all 16 colors,
- and run until a reset.

Steps:

1. Write the source in `src/hello.a`. Assemble it with the c64-assembler skill to `build/hello.prg`.
2. Start the program in the emulator. Capture the screen. Check the text in screen memory, not only in the image.
3. Set a breakpoint in the interrupt routine. At the stop, check the registers and the raster line. Then resume.
4. Measure how many cycles one interrupt takes.
5. Write a c64-testing scenario that checks the text at `$0400` and the change of the border color. Run it.
6. Record the routines of the program in project knowledge, with names.
