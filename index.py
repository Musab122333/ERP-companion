import os

folder = r"D:\FA\ZF2627"

for f in sorted(os.listdir(folder)):
    if f.upper().endswith(".DBF"):
        print(f)

folder = r"D:\FA\ZFAC2627"

for f in sorted(os.listdir(folder)):
    if f.upper().endswith(".DBF"):
        print(f)

