# openide - Python Sample File
# Click "Run (F5)" in the top bar or the bottom-right FAB button to execute!

import sys
from datetime import datetime

# TODO: Add data visualization helper module
# NOTE: Material You seed colors: #7C4DFF, #38BDF8, #10B981, #F97316

def fibonacci(n: int) -> list[int]:
    """Computes the first n Fibonacci numbers."""
    seq = [0, 1]
    for _ in range(2, n):
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

def main():
    print("=" * 54)
    print("  openide - Python Execution Environment")
    print(f"  Timestamp      : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Python Version : {sys.version.split()[0]}")
    print("=" * 54)

    fib_numbers = fibonacci(12)
    print(f"\nFirst 12 Fibonacci Numbers:\n  -> {fib_numbers}")
    print(f"  -> Sum: {sum(fib_numbers)}")
    print("\nExecution finished successfully!")

if __name__ == "__main__":
    main()
