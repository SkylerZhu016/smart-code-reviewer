def sort_in_place(arr):
    n = len(arr)
    for i in range(n - 1):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

my_list = [64, 34, 25, 12, 22, 11, 90]
sorted_list = sort_in_place(my_list)
print(sorted_list)
