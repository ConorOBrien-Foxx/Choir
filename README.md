# Choir

`words_alpha.js` modified from https://github.com/dwyl/english-words .

## Description

The high bit of every 8-bit byte indicates whether the byte is a literal or an instruction. In practice, the character `/` is used in the literate version of the language to signal a run of high/low bits (initially high). For example, the following literate program corresponds to the following bytes:

```
literate program
    abc/def
bytes without /
    01100001 01100010 01100011 01100100 01100101 01100110
with high bits adjusted
    11100001 11100010 11100011 01100100 01100101 01100110
corresponding program
    áâãdef
```

Therefore, `/` have no associated byte cost.

## Instructions

`N` refers to a number, `S` to a string, and `X` to anything. A tilde `~` indicates the argument order doesn't matter.

```
command     stack       effect
⁺           [N]         [N]: increment; N + 1
⁻           [N]         [N]: decrement; N - 1
□           []          []: No-op
"           []          [S]: pushes a string
#           []          []: erases the current build string
$           [X1,X2]     [X1]: drop top of stack
+           [N1,N2]     [N]: addition; N1 + N2
-           [N1,N2]     [N]: subtract; N1 - N2
:           [X]         [X,X]: duplicate top of stack
@           [S,N]~      [S]: Nth character in S
C           [S,N]~      [C]: center; middle N characters of S
H           [S,N]~      [S]: head; first N characters of S
I           [N]         [N]: add 2; double increment; N + 2
J           [N]         [N]: subtract 2; double decrement; N - 2
T           [S,N]~      [S]: tail; last N characters of S
c           [S1,S2]     [N]: S1 concatenated with S2
d           []          []: interpret next literal section as compressed
}           []          [S]: pushes the currently built string up til now
~           [X1,X2]     [X2,X1]: swap top two on stack
⌂D          []          []: Debug
```

## 7-Bit code page

```
  0123456789ABCDEF
0 ¬¡±×÷Œœµ«»¶ΣΠ§¡¿
1 ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ
2 □!"#$%&'()*+,-./
3 0123456789:;<=>?
4 @ABCDEFGHIJKLMNO
5 PQRSTUVWXYZ[\]^_
6 `abcdefghijklmno
7 pqrstuvwxyz{|}~⌂
```

## Compression modes

All compression modes index into a dictionary. Similar to Jelly's compression.

All of these modes work by parsing out the bits corresponding to a base-255 integer, and then parsing that integer as indices into a list.

### Mode 1 (`d`)

Uses the hi bit system to demarcate sections. This "burns" 1 hi-bit every 7 bits. After 8 bytes used to encode, it is less efficient than `e`.

### Mode 2 (`e`)

Uses the next byte as the number of bytes to read next. Then, reads that many bytes. Overhead of 8 bits, but more efficient than `d` after 8 bytes.

### Mode 3 (`h`...`⌂`)

Uses the delimeter `⌂` to terminate strings.