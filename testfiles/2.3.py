def is_palindrome_two_pointers(s):
    left, right = 0, len(s) - 1
    while left < right:
        if s[left] != s[right]:
            return False
        left += 1
        right -= 1
    return True

import sys
test_input = sys.stdin.read().strip()
if test_input:
    print(is_palindrome_two_pointers(test_input))
else:
    print(is_palindrome_two_pointers('racecar'))
