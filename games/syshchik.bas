   1 REM СЫЩИК
   2 REM ночная улица
   3 CLEAR 59199
   4 LOAD "" CODE
   5 POKE 23606,0: POKE 23607,231: POKE 23675,0: POKE 23676,235
  10 GO SUB 8000
  20 GO SUB 7000
  30 GO SUB 5000
  40 LET k$=INKEY$
  50 IF k$="" THEN GO TO 40
  60 IF k$="o" OR k$="O" THEN LET j=h-1: GO SUB 5600
  70 IF k$="p" OR k$="P" THEN LET j=h+1: GO SUB 5600
  80 IF k$=" " THEN GO SUB 6000
  90 IF INKEY$<>"" THEN GO TO 90
 100 GO TO 40
1000 REM ---- вот он ----
1010 GO SUB 5700
1020 LET sr=8: LET sc=(h-1)*6+2: LET sb=152: LET si=2: GO SUB 5400
1030 LET m$="ВОТ ОН!": LET n$="ДЕРЖИ ВОРА!": GO SUB 5500
1040 FOR i=1 TO 8: BEEP .03,i*2: NEXT i
1050 LET sr=8: LET sc=(h-1)*6+2: GO SUB 5450
1060 LET tx=(h-1)*6+4: LET px=(h-1)*6+2
1070 FOR i=1 TO 7
1080 LET sr=10: LET sc=tx: GO SUB 5450
1090 LET sc=px: GO SUB 5450
1100 LET tx=tx+1: LET px=px+1
1110 IF tx>29 THEN LET tx=29
1120 IF px>27 THEN LET px=27
1130 LET sr=10: LET sc=tx: LET sb=152: LET si=2: GO SUB 5400
1140 LET sc=px: LET sb=144+4*(i-2*INT (i/2)): LET si=7: GO SUB 5400
1150 BEEP .02,26: BEEP .02,20
1160 NEXT i
1170 FOR i=1 TO 6
1180 PRINT AT 10,tx;FLASH 1;INK 6;CHR$ 152;CHR$ 153;AT 11,tx;CHR$ 154;CHR$ 155
1190 BEEP .05,i*3
1200 PRINT AT 10,tx;FLASH 0;INK 2;CHR$ 152;CHR$ 153;AT 11,tx;CHR$ 154;CHR$ 155
1210 BEEP .05,i*3+5
1220 NEXT i
1230 LET m$="ВЗЯТ С ПОЛИЧНЫМ.": LET n$="ДЕЛО ЗАКРЫТО.": GO SUB 5500
1240 FOR i=1 TO 8: READ p: BEEP .12,p: NEXT i
1250 GO TO 4100
4000 REM ---- ушел ----
4010 LET m$="УШЕЛ ДВОРАМИ.": LET n$="ОН БЫЛ ЗА МИГАЮЩЕЙ ДВЕРЬЮ.": GO SUB 5500
4020 FOR i=1 TO 6
4030 PRINT AT 8,(th-1)*6+2;PAPER 0;FLASH 1;INK 2;CHR$ 152;CHR$ 153;AT 9,(th-1)*6+2;CHR$ 154;CHR$ 155
4040 BEEP .12,12-i*2
4050 NEXT i
4100 PRINT AT 21,0;INK 5;FLASH 1;"  НАЖМИ КЛАВИШУ - НОВОЕ ДЕЛО  "
4110 PAUSE 0
4120 RUN
5000 REM ---- рисуем улицу ----
5010 BORDER 0: PAPER 0: INK 7: CLS
5020 PRINT AT 0,0;INK 5;"СЫЩИК";AT 0,20;INK 4;"НОЧНАЯ УЛИЦА"
5030 INK 6: FOR i=1 TO 6: CIRCLE 30,160,i: NEXT i
5040 INK 7: FOR i=1 TO 18: PLOT 50+INT (RND*200),152+INT (RND*15): NEXT i
5050 FOR i=1 TO 5: LET g=i: GO SUB 5200: NEXT i
5060 PRINT AT 12,0;PAPER 1;"                                "
5070 FOR i=0 TO 31: PRINT AT 14,i;PAPER 0;INK 1;CHR$ 131: NEXT i
5080 LET sr=10: LET sc=(h-1)*6+2: LET sb=144: LET si=7: GO SUB 5400
5090 PRINT AT 21,0;PAPER 0;INK 4;" O P - ИДТИ   ПРОБЕЛ - СТУЧАТЬ"
5100 GO SUB 5500
5110 RETURN
5200 REM ---- один дом ----
5210 LET cx=(g-1)*6+1
5220 PRINT AT 3,cx;PAPER 2;"     "
5230 PRINT AT 4,cx;PAPER 1;"     "
5240 PRINT AT 5,cx;PAPER 1;" ";PAPER w(g);" ";PAPER 1;" ";PAPER w(g);" ";PAPER 1;" "
5250 PRINT AT 6,cx;PAPER 1;"     "
5260 PRINT AT 7,cx;PAPER 1;" ";PAPER w(g);" ";PAPER 1;" ";PAPER w(g);" ";PAPER 1;" "
5270 PRINT AT 8,cx;PAPER 1;"  ";PAPER 0;" ";PAPER 1;"  "
5280 PRINT AT 9,cx;PAPER 1;"  ";PAPER 0;" ";PAPER 1;"  "
5290 RETURN
5400 REM ---- ставим человечка ----
5410 PRINT AT sr,sc;PAPER 0;INK si;CHR$ sb;CHR$ (sb+1);AT sr+1,sc;CHR$ (sb+2);CHR$ (sb+3)
5420 RETURN
5450 REM ---- убираем его ----
5460 PRINT AT sr,sc;PAPER 0;"  ";AT sr+1,sc;"  "
5470 RETURN
5500 REM ---- панель внизу ----
5510 PRINT AT 15,0;PAPER 0;"                                "
5520 PRINT AT 15,1;INK 6;m$
5530 PRINT AT 17,0;PAPER 0;"                                "
5540 PRINT AT 17,1;INK 7;n$
5550 PRINT AT 19,1;INK 5;"СТУКИ ";st;"  "
5560 RETURN
5600 REM ---- переход к дому j ----
5610 IF j<1 OR j>5 THEN RETURN
5620 GO SUB 5700
5630 LET c1=(h-1)*6+2: LET c2=(j-1)*6+2: LET d=SGN (c2-c1)
5640 FOR i=1 TO ABS (c2-c1)
5650 LET sr=10: LET sc=c1+(i-1)*d: GO SUB 5450
5660 LET sc=c1+i*d: LET sb=144+4*(i-2*INT (i/2)): LET si=7: GO SUB 5400
5670 BEEP .012,22
5680 NEXT i
5690 LET h=j: LET sr=10: LET sc=c2: LET sb=144: LET si=7: GO SUB 5400
5695 RETURN
5700 REM ---- свидетель уходит ----
5710 IF q=0 THEN RETURN
5720 LET sr=8: LET sc=(q-1)*6+2: GO SUB 5450
5730 LET q=0
5740 RETURN
6000 REM ---- стучим в дверь ----
6010 GO SUB 5700
6020 IF h=th THEN GO TO 1000
6030 LET q=h
6040 LET sb=156: LET si=6
6050 IF h-2*INT (h/2)=0 THEN LET sb=160: LET si=5
6060 LET sr=8: LET sc=(h-1)*6+2: GO SUB 5400
6070 LET m$="СТАРУШКА ГОВОРИТ:"
6080 IF sb=160 THEN LET m$="МАЛЬЧИШКА ГОВОРИТ:"
6090 LET dd=th-h
6100 LET n$="ОН В СОСЕДНЕМ ДОМЕ, "
6110 IF ABS dd=2 THEN LET n$="ЧЕРЕЗ ДОМ ОТСЮДА, "
6120 IF ABS dd=3 THEN LET n$="ТРИ ДОМА ОТСЮДА, "
6130 IF ABS dd=4 THEN LET n$="В ДРУГОМ КОНЦЕ УЛИЦЫ, "
6140 IF dd>0 THEN LET n$=n$+"ПРАВЕЕ."
6150 IF dd<0 THEN LET n$=n$+"ЛЕВЕЕ."
6160 LET st=st-1
6170 BEEP .04,4: BEEP .04,9: BEEP .04,4
6180 GO SUB 5500
6190 IF st<1 THEN GO TO 4000
6195 RETURN
7000 REM ---- новое дело ----
7010 BORDER 0: PAPER 0: INK 5: CLS: PRINT AT 10,3;FLASH 1;"НА УЛИЦЕ ГАСНУТ ОКНА"
7020 DIM w(5)
7030 FOR i=1 TO 5
7040 LET w(i)=6
7050 IF RND<.45 THEN LET w(i)=0
7060 NEXT i
7070 LET th=1+INT (RND*5)
7080 LET h=3: LET st=4: LET q=0
7090 LET m$="НОЧНАЯ УЛИЦА. ВОР ЗДЕСЬ."
7095 LET n$="СТУЧИ В ДВЕРИ И СПРАШИВАЙ."
7099 RETURN
8000 REM ---- заставка ----
8010 BORDER 0: PAPER 0: INK 7: CLS
8020 FOR i=0 TO 7: PRINT AT 1,4+i*3;PAPER i;"   ": NEXT i
8030 PRINT AT 4,11;INK 6;"С Ы Щ И К"
8040 PRINT AT 6,10;INK 5;"НОЧНАЯ УЛИЦА"
8050 LET sr=9: LET sc=8: LET sb=144: LET si=7: GO SUB 5400
8060 LET sr=9: LET sc=14: LET sb=156: LET si=6: GO SUB 5400
8070 LET sr=9: LET sc=20: LET sb=152: LET si=2: GO SUB 5400
8080 PRINT AT 12,1;INK 7;"ВОР ПРЯЧЕТСЯ ЗА ОДНОЙ ИЗ"
8090 PRINT AT 13,1;INK 7;"ПЯТИ ДВЕРЕЙ НА ЭТОЙ УЛИЦЕ."
8100 PRINT AT 15,1;INK 4;"O P    - ИДТИ ПО УЛИЦЕ"
8110 PRINT AT 16,1;INK 4;"ПРОБЕЛ - ПОСТУЧАТЬ В ДВЕРЬ"
8120 PRINT AT 18,1;INK 6;"СВИДЕТЕЛИ СКАЖУТ, ГДЕ ОН."
8130 PRINT AT 19,1;INK 6;"У ТЕБЯ ЧЕТЫРЕ СТУКА."
8140 PRINT AT 21,6;INK 5;FLASH 1;"НАЖМИ ЛЮБУЮ КЛАВИШУ"
8150 FOR i=1 TO 6: READ p: BEEP .1,p: NEXT i
8160 PAUSE 0
8170 RETURN
9500 DATA 0,4,7,12,7,12
9510 DATA 12,16,19,24,19,24,26,31
9520 REM шрифт и спрайты приехали блоком кода на 59392, знакогенератор
9530 REM переставлен на 59136, а рисунки на 60160
