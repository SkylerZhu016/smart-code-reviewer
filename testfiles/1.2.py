def sum_even_numbers_optimized():
    total_sum = 0
    for number in range(2, 101, 2):
        total_sum += number
    return total_sum

if __name__ == "__main__":
    result = sum_even_numbers_optimized()
    print(result)
