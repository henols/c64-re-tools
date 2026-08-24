//===== sub_810 @ 0810

void sub_810(void)

{
  byte bVar1;
  
  DAT_d020 = 0;
  bVar1 = 0;
  do {
    (&DAT_08df)[bVar1] = (&data_8bf)[bVar1];
    bVar1 = bVar1 + 1;
  } while (bVar1 != 0x20);
  DAT_00fb = (code *)CONCAT11(DAT_08b0,DAT_08ad);
                    /* WARNING: Could not recover jumptable at 0x082e. Too many branches */
                    /* WARNING: Treating indirect jump as call */
  (*DAT_00fb)();
  return;
}


//===== sub_817 @ 0817

void sub_817(byte param_1)

{
  do {
    (&DAT_08df)[param_1] = (&data_8bf)[param_1];
    param_1 = param_1 + 1;
  } while (param_1 != 0x20);
  DAT_00fb = (code *)CONCAT11(DAT_08b0,DAT_08ad);
                    /* WARNING: Could not recover jumptable at 0x082e. Too many branches */
                    /* WARNING: Treating indirect jump as call */
  (*DAT_00fb)();
  return;
}


//===== sub_831 @ 0831

void sub_831(void)

{
  return;
}


//===== sub_83c @ 083c

void sub_83c(void)

{
  byte bVar1;
  byte bVar2;
  
  bVar2 = 0;
  do {
    if ((&data_8ff)[bVar2] != '\0') {
      bVar1 = (&DAT_0900)[bVar2];
      (&DAT_0900)[bVar2] = bVar1 + (&DAT_0902)[bVar2];
      (&DAT_0901)[bVar2] =
           (&DAT_0901)[bVar2] + (&DAT_0903)[bVar2] + CARRY1(bVar1,(&DAT_0902)[bVar2]);
    }
    bVar2 = bVar2 + 5;
  } while (bVar2 != 0x19);
  return;
}


//===== sub_83e @ 083e

void sub_83e(byte param_1)

{
  byte bVar1;
  
  do {
    if ((&data_8ff)[param_1] != '\0') {
      bVar1 = (&DAT_0900)[param_1];
      (&DAT_0900)[param_1] = bVar1 + (&DAT_0902)[param_1];
      (&DAT_0901)[param_1] =
           (&DAT_0901)[param_1] + (&DAT_0903)[param_1] + CARRY1(bVar1,(&DAT_0902)[param_1]);
    }
    param_1 = param_1 + 5;
  } while (param_1 != 0x19);
  return;
}


//===== sub_843 @ 0843

void sub_843(byte param_1)

{
  byte bVar1;
  
  do {
    bVar1 = (&DAT_0900)[param_1];
    (&DAT_0900)[param_1] = bVar1 + (&DAT_0902)[param_1];
    (&DAT_0901)[param_1] =
         (&DAT_0901)[param_1] + (&DAT_0903)[param_1] + CARRY1(bVar1,(&DAT_0902)[param_1]);
    do {
      param_1 = param_1 + 5;
      if (param_1 == 0x19) {
        return;
      }
    } while ((&data_8ff)[param_1] == '\0');
  } while( true );
}


//===== sub_856 @ 0856

void sub_856(byte param_1)

{
  byte bVar1;
  
  while (param_1 = param_1 + 5, param_1 != 0x19) {
    if ((&data_8ff)[param_1] != '\0') {
      bVar1 = (&DAT_0900)[param_1];
      (&DAT_0900)[param_1] = bVar1 + (&DAT_0902)[param_1];
      (&DAT_0901)[param_1] =
           (&DAT_0901)[param_1] + (&DAT_0903)[param_1] + CARRY1(bVar1,(&DAT_0902)[param_1]);
    }
  }
  return;
}


//===== sub_85f @ 085f

void sub_85f(void)

{
  return;
}


//===== sub_860 @ 0860

/* WARNING: Control flow encountered bad instruction data */

void sub_860(void)

{
  undefined1 uStack0000;
  
  uStack0000 = 8;
  sub_871();
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}


//===== sub_86d @ 086d

byte sub_86d(byte param_1,byte param_2)

{
  return param_1 ^ *(byte *)(param_2 + 0x45);
}


//===== sub_871 @ 0871

/* WARNING: Globals starting with '_' overlap smaller symbols at the same address */

void sub_871(void)

{
  byte bVar1;
  short unaff_retaddr;
  
  _DAT_00fd = unaff_retaddr;
  bVar1 = 1;
  do {
    if (*(char *)(_DAT_00fd + (ushort)bVar1) == '\0') break;
    func_0xffd2();
    bVar1 = bVar1 + 1;
  } while (bVar1 != 0);
  _DAT_00fd = CONCAT11(DAT_00fe,bVar1 + DAT_00fd);
  return;
}


//===== sub_879 @ 0879

/* WARNING: Globals starting with '_' overlap smaller symbols at the same address */

void sub_879(byte param_1)

{
  undefined1 uStack0000;
  
  do {
    if (*(char *)(_DAT_00fd + (ushort)param_1) == '\0') break;
    uStack0000 = 8;
    func_0xffd2();
    param_1 = param_1 + 1;
  } while (param_1 != 0);
  _DAT_00fd = CONCAT11(DAT_00fe,param_1 + DAT_00fd);
  return;
}


//===== sub_883 @ 0883

void sub_883(char param_1)

{
  DAT_00fd = param_1 + DAT_00fd;
  return;
}


//===== sub_892 @ 0892

void sub_892(void)

{
  DAT_d021 = DAT_d021 + '\x01';
  return;
}


//===== sub_896 @ 0896

void sub_896(void)

{
  DAT_d021 = DAT_d021 + -1;
  return;
}


//===== sub_89a @ 089a

void sub_89a(void)

{
  DAT_d021 = 7;
  return;
}


//===== sub_8a0 @ 08a0

void sub_8a0(void)

{
  uRAM08a6 = 0xaa;
  DAT_0400 = 0;
  return;
}


