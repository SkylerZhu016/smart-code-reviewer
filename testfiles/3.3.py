def bubble_sort_wrong_bound(arr):
    n = len(arr)
    new_arr = arr.copy()
    for i in range(n):
        for j in range(0, n):
            if new_arr[j] > new_arr[j + 1]:
                new_arr[j], new_arr[j + 1] = new_arr[j + 1], new_arr[j]
    return new_arr

try:
    bubble_sort_wrong_bound([5, 2, 3])
except IndexError as e:
    print(f"代码出错了: {e}")
