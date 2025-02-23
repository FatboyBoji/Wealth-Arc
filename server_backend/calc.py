numbers=[10,11,12]

def H(n):
    return (n**(n % 60)) % 99

for x in numbers:
    print(H(x))