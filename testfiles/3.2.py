def bubble_sort_optimized(arr):
    n = len(arr)
    new_arr = arr[:]
    for i in range(n - 1):
        swapped = False
        for j in range(0, n - i - 1):
            if new_arr[j] > new_arr[j + 1]:
                new_arr[j], new_arr[j + 1] = new_arr[j + 1], new_arr[j]
                swapped = True
        if not swapped:
            break
    return new_arr

my_list = [5, 1, 4, 2, 8]
print(bubble_sort_optimized(my_list))
