class Solution:
    def pattern3(self, n):
        for i in range(n):
        #space 
            for j in range(i):
                print(" ",end="")
        #stars
            for k in range(2*n-2*i-1):
                print("*",end="")
            
        #space 
            for j in range(i):
                print(" ",end="")
            print()
s= Solution()
s.pattern3(5)