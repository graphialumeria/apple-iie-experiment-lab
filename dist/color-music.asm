; COLOR / PULSE — an original Apple IIe color-and-speaker ROM.
; NMOS 6502, main RAM, standard 40x48 lo-res video, built-in 1-bit speaker.
; No Apple firmware calls, auxiliary memory, peripherals, or 65C02 opcodes.
; Standalone 12 KB system-ROM image at $D000-$FFFF, entry at $D000.
; Zero page: 00/01 row pointer, 02 color phase, 03 row, 04 pattern,
; 05 row group, 06 palette index, 07 note index, 08 pitch delay,
; 09/0A remaining speaker transitions. Stack at $0100.
; Melody is original: four repeating arpeggio phrases.
; Three layouts rotate every eight notes; every note rotates the palette.
; Draw between notes, then hold the image while playing a staccato tone.

.org $D000
reset:
    SEI
    CLD
    LDX #$FF
    TXS
    LDA #$00
    STA $C000           ; 80STORE off (write only, unlike keyboard reads)
    STA $C002           ; RAMRD main
    STA $C004           ; RAMWRT main
    STA $C008           ; main zero page and stack
    STA $C00C           ; 40 columns
    BIT $C082           ; language card read ROM, write disabled
    BIT $C050           ; graphics
    BIT $C052           ; full-screen graphics
    BIT $C054           ; page 1
    BIT $C056           ; low resolution
    BIT $C05F           ; disable double-width graphics
    STA $02
    STA $04
    STA $07
next_note:
    JSR draw
    LDX $07
    LDA delays,X
    STA $08
    LDA lengths_lo,X
    STA $09
    LDA lengths_hi,X
    STA $0A
    JSR tone
    INC $02             ; rotate color palette for next note
    INC $07
    LDA $07
    AND #$07
    BNE same_pattern
    INC $04
    LDA $04
    CMP #$03
    BNE same_pattern
    LDA #$00
    STA $04
same_pattern:
    LDA $07
    CMP #$20
    BNE next_note
    LDA #$00
    STA $07
    JMP next_note

.org $D100
; Write 24 memory rows, two lo-res pixels per byte.
; Both nibbles have the same color, forming chunky rectangular blocks.
draw:
    LDX #$00
row:
    STX $03
    LDA rows_lo,X
    STA $00
    LDA rows_hi,X
    STA $01
    LDA row_groups,X
    STA $05
    LDY #$00
column:
    LDA $04
    BEQ tiles
    CMP #$01
    BEQ bars
    LDA $05             ; pattern 2: horizontal bands
    JMP color
tiles:
    LDA col_groups,Y
    CLC
    ADC $05             ; pattern 0: diagonal color tiles
    JMP color
bars:
    LDA col_groups,Y    ; pattern 1: vertical bars
color:
    CLC
    ADC $02
    AND #$0F
    TAX
    LDA palette,X
    STA ($00),Y
    INY
    CPY #$28
    BNE column
    LDX $03
    INX
    CPX #$18
    BNE row
    RTS

.org $D200
; Precisely timed speaker loop stays within one page.
; Normal transition interval = 5*delay + 26 CPU cycles.
; Every 256th transition adds 4 cycles for a 16-bit counter borrow.
; Pitch table and even transition counts target ~200 ms notes at 1.020484 MHz.
tone:
    BIT $C030           ; toggle physical speaker diaphragm
    LDX $08
wait:
    DEX
    BNE wait
    LDA $09
    BNE no_borrow
    DEC $0A
no_borrow:
    DEC $09
    LDA $09
    ORA $0A
    BNE tone
    RTS
irq:
    RTI

.org $D300
rows_lo:
    .byte $00, $80, $00, $80, $00, $80, $00, $80, $28, $A8, $28, $A8, $28, $A8, $28, $A8
    .byte $50, $D0, $50, $D0, $50, $D0, $50, $D0

rows_hi:
    .byte $04, $04, $05, $05, $06, $06, $07, $07, $04, $04, $05, $05, $06, $06, $07, $07
    .byte $04, $04, $05, $05, $06, $06, $07, $07

row_groups:
    .byte $00, $00, $00, $00, $01, $01, $01, $01, $02, $02, $02, $02, $03, $03, $03, $03
    .byte $04, $04, $04, $04, $05, $05, $05, $05

col_groups:
    .byte $00, $00, $00, $00, $00, $01, $01, $01, $01, $01, $02, $02, $02, $02, $02, $03
    .byte $03, $03, $03, $03, $04, $04, $04, $04, $04, $05, $05, $05, $05, $05, $06, $06
    .byte $06, $06, $06, $07, $07, $07, $07, $07

palette:
    .byte $11, $99, $DD, $CC, $44, $EE, $66, $22, $33, $77, $FF, $BB, $AA, $55, $88, $00

delays: ; Notes: C5 E5 G5 C6 B5 G5 E5 G5 A4 C5 E5 A5 G5 E5 C5 E5 F5 A4 C5 F5 E5 C5 A4 C5 G4 B4 D5 G5 F5 D5 B4 G4
    .byte $BE, $96, $7D, $5C, $62, $7D, $96, $7D, $E3, $BE, $96, $6F, $7D, $96, $BE, $96
    .byte $8D, $E3, $BE, $8D, $96, $BE, $E3, $BE, $FF, $C9, $A9, $7D, $8D, $A9, $C9, $FF

lengths_lo:
    .byte $D2, $08, $3A, $A4, $8C, $3A, $08, $3A, $B0, $D2, $08, $60, $3A, $08, $D2, $08
    .byte $18, $B0, $D2, $18, $08, $D2, $B0, $D2, $9C, $C6, $EA, $3A, $18, $EA, $C6, $9C

lengths_hi:
    .byte $00, $01, $01, $01, $01, $01, $01, $01, $00, $00, $01, $01, $01, $01, $00, $01
    .byte $01, $00, $00, $01, $01, $00, $00, $00, $00, $00, $00, $01, $01, $00, $00, $00

; NMI, reset, and IRQ/BRK vectors.
.org $FFFA
    .word irq, reset, irq
