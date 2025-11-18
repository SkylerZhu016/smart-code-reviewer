def bubble_sort(arr):
    n = len(arr)
    new_arr = arr.copy()
    for i in range(n - 1):
        for j in range(0, n - i - 1):
            if new_arr[j] > new_arr[j + 1]:
                new_arr[j], new_arr[j + 1] = new_arr[j + 1], new_arr[j]
    return new_arr

my_list = [64, 34, 25, 12, 22, 11, 90]
sorted_list = bubble_sort(my_list)
print(sorted_list)
