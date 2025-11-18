def sum_even_numbers(start, end):
    total_sum = 0
    for number in range(start, end + 1):
        if number % 2 == 0:
            total_sum += number
    return total_sum

if __name__ == "__main__":
    result = sum_even_numbers(1, 100)
    print(result)
