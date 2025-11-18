def is_palindrome(s):
    formatted_s = s.replace(' ', '').lower()
    return formatted_s == formatted_s[::-1]

import sys
test_input = sys.stdin.read().strip()
if test_input:
    print(is_palindrome(test_input))
else:
    print(is_palindrome('level'))
