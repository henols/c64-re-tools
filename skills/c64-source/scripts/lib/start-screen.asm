; The start screen of the program: the loader shows it after its copies and
; waits for a key or a fire button on joystick port 1 or 2. Then the loader
; sets the entry state and starts the program.
; The loader includes this file in its copier, with the interrupts off. The
; code uses no stack and writes only the I/O area, the colour RAM and its own
; bytes: the copies wrote pages 0-3 of the entry state already.
; Set START_SCREEN = 0 in config.asm to start the program at once.
; loader.asm sets these values from the start screen of the knowledge:
;   c64_source_ss_d011, c64_source_ss_d016, c64_source_ss_d018: the VIC-II mode
;   c64_source_ss_bank: the VIC bank, as bits 0-1 of $dd00
;   c64_source_ss_border, c64_source_ss_background: the colours
;   c64_source_ss_colour_mode: 0 no colour RAM, 1 one colour, 2 a copy of 1000 bytes
;   c64_source_ss_colour: the one colour (mode 1)
;   c64_source_ss_colours: the address of the 1000 bytes (mode 2)

!ifndef START_SCREEN { START_SCREEN = 1 }

        lda #START_SCREEN
        bne .on
        jmp .end
.port   !byte 0
.ddra   !byte 0
.ddrb   !byte 0
.joy    !byte 0

.on     lda #$35
        sta $01
        ; CIA 1: port A drives the keyboard rows, port B reads the columns.
        lda $dc00
        sta .port
        lda $dc02
        sta .ddra
        lda $dc03
        sta .ddrb
        lda #$ff
        sta $dc02
        lda #$00
        sta $dc03
        ; The display is off until the colour RAM is set.
        lda #$0b
        sta $d011
        lda #$00
        sta $d015
        lda $dd00
        and #$fc
        ora #c64_source_ss_bank
        sta $dd00
        lda #c64_source_ss_d018
        sta $d018
        lda #c64_source_ss_d016
        sta $d016
        lda #c64_source_ss_border
        sta $d020
        lda #c64_source_ss_background
        sta $d021
!if c64_source_ss_colour_mode = 1 {
        lda #c64_source_ss_colour
        ldx #250
.fill   sta $d7ff,x
        sta $d8f9,x
        sta $d9f3,x
        sta $daed,x
        dex
        bne .fill
}
!if c64_source_ss_colour_mode = 2 {
        ldx #250
.copy   lda c64_source_ss_colours-1,x
        sta $d7ff,x
        lda c64_source_ss_colours+249,x
        sta $d8f9,x
        lda c64_source_ss_colours+499,x
        sta $d9f3,x
        lda c64_source_ss_colours+749,x
        sta $daed,x
        dex
        bne .copy
}
        lda #c64_source_ss_d011
        sta $d011

        ; Y is the phase: 0 waits until nothing is pressed, for example the
        ; RETURN of RUN; 1 waits for a press; 2 waits until it is released.
loader_start_screen_wait
        ldy #0
.poll   lda #$ff
        sta $dc00
        ; No keyboard row is driven: $dc01 gives joystick 1 alone.
        lda $dc01
        sta .joy
        and #$10
        beq .down
        lda $dc00
        and #$10
        beq .down
        ; All keyboard rows are driven: a key pulls a column low. A column is a
        ; key only when joystick 1 holds it high before and after this read,
        ; so a move of joystick 1 between the reads is not a key.
        lda #$00
        sta $dc00
        lda $dc01
        eor #$ff
        and .joy
        sta .joy
        lda #$ff
        sta $dc00
        lda $dc01
        and .joy
        bne .down
        tya
        beq .settle
        cmp #2
        beq loader_start_screen_continue
        bne .poll
.down   cpy #1
        bne .poll
        iny
        bne .poll
        ; Two frames after the release, a bounce of the key is not a press.
.settle ldx #2
.frame  lda $d012
        cmp #$80
        bne .frame
.leave  lda $d012
        cmp #$80
        beq .leave
        dex
        bne .frame
        iny
        bne .poll

loader_start_screen_continue
        lda .port
        sta $dc00
        lda .ddra
        sta $dc02
        lda .ddrb
        sta $dc03
.end
