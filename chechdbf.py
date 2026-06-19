f = open(r"D:\FA\ZF2526\SALES1.DBF", "rb")

f.read(32)

while True:
    fd = f.read(32)
    if not fd or fd[0] == 0x0D:
        break

    print(
        fd[:11].replace(b"\x00", b"").decode("ascii", "ignore"),
        chr(fd[11]),
        fd[16]
    )

f.close()