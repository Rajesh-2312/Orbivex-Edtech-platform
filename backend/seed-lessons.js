/**
 * Seed script — creates sample courses & lessons with rich content
 * for testing the AI Question Generation feature.
 *
 * Run: node seed-lessons.js
 *
 * Creates:
 *   TECHNICAL:
 *     - C Programming (5 lessons)
 *     - Python Programming (5 lessons)
 *   NON-TECHNICAL:
 *     - Aptitude & Reasoning (5 lessons)
 *     - Verbal Ability (5 lessons)
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ═══════════════════════════════════════════
// COURSES
// ═══════════════════════════════════════════

const COURSES = [
  {
    title: 'C Programming Fundamentals',
    description: 'Learn the C programming language from basics to advanced concepts including pointers, memory management, file handling, and data structures.',
    category: 'programming',
    difficulty: 'beginner',
  },
  {
    title: 'Python Programming',
    description: 'Complete Python programming course covering syntax, data structures, OOP, file handling, error handling, and popular libraries.',
    category: 'programming',
    difficulty: 'beginner',
  },
  {
    title: 'Aptitude & Logical Reasoning',
    description: 'Quantitative aptitude, logical reasoning, and data interpretation — essential for competitive exams and placement tests.',
    category: 'general',
    difficulty: 'intermediate',
  },
  {
    title: 'Verbal Ability & Communication',
    description: 'English verbal ability covering grammar, vocabulary, reading comprehension, sentence correction, and para jumbles for placement preparation.',
    category: 'general',
    difficulty: 'intermediate',
  },
];

// ═══════════════════════════════════════════
// LESSONS — C Programming
// ═══════════════════════════════════════════

const C_LESSONS = [
  {
    title: 'Introduction to C & Data Types',
    sort_order: 1,
    duration_minutes: 45,
    content_text: `C Programming Language — Introduction and Data Types

C is a general-purpose, procedural programming language developed by Dennis Ritchie at Bell Labs in 1972. It is one of the most widely used programming languages of all time and forms the foundation for many modern languages like C++, Java, and Python.

Structure of a C Program:
Every C program has a specific structure. It begins with preprocessor directives like #include <stdio.h>, followed by the main() function which is the entry point of every C program. The main function returns an integer value to the operating system indicating successful or unsuccessful execution.

#include <stdio.h>
int main() {
    printf("Hello, World!");
    return 0;
}

Data Types in C:
C provides several basic data types:

1. int — Stores integers (whole numbers). Typically 4 bytes. Range: -2,147,483,648 to 2,147,483,647.
   Example: int age = 25;

2. float — Stores single-precision floating-point numbers (decimals). 4 bytes. Precision: ~6-7 decimal digits.
   Example: float pi = 3.14;

3. double — Stores double-precision floating-point numbers. 8 bytes. Precision: ~15-16 decimal digits.
   Example: double precise_pi = 3.14159265358979;

4. char — Stores a single character. 1 byte. Stored as ASCII value.
   Example: char grade = 'A';

5. void — Represents no type. Used for functions that don't return a value.

Type Modifiers:
- short: Reduces storage size (short int uses 2 bytes)
- long: Increases storage size (long int may use 8 bytes)
- signed: Can hold positive and negative values (default)
- unsigned: Can only hold positive values, doubling the positive range

Variables and Constants:
A variable is a named memory location that stores a value. Variables must be declared before use.
A constant is a value that cannot be changed during program execution, declared using the const keyword or #define preprocessor directive.

const float PI = 3.14159;
#define MAX_SIZE 100

Format Specifiers:
- %d for int
- %f for float
- %lf for double
- %c for char
- %s for string
- %p for pointer address
- %u for unsigned int

The sizeof operator returns the size of a data type in bytes:
printf("Size of int: %lu bytes", sizeof(int));

Type Casting:
Implicit type casting happens automatically when assigning a smaller type to a larger type.
Explicit type casting requires the programmer to specify: float result = (float)5 / 2; // result = 2.5`,
  },
  {
    title: 'Operators and Control Flow',
    sort_order: 2,
    duration_minutes: 50,
    content_text: `C Programming — Operators and Control Flow Statements

Operators in C:
Operators are symbols that perform operations on variables and values.

1. Arithmetic Operators: +, -, *, /, % (modulus)
   - Division of two integers gives integer result: 5/2 = 2
   - Modulus gives remainder: 5%2 = 1
   - Modulus only works with integers, not floats

2. Relational Operators: ==, !=, <, >, <=, >=
   - Return 1 (true) or 0 (false)
   - Common mistake: using = (assignment) instead of == (comparison)

3. Logical Operators: && (AND), || (OR), ! (NOT)
   - Short-circuit evaluation: in (a && b), if a is false, b is not evaluated
   - In (a || b), if a is true, b is not evaluated

4. Bitwise Operators: & (AND), | (OR), ^ (XOR), ~ (complement), << (left shift), >> (right shift)
   - Work on individual bits of integer values
   - Left shift by 1 is equivalent to multiplying by 2
   - Right shift by 1 is equivalent to dividing by 2

5. Assignment Operators: =, +=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>=
   - x += 5 is equivalent to x = x + 5

6. Increment/Decrement: ++ (increment by 1), -- (decrement by 1)
   - Pre-increment (++x): increments first, then uses the value
   - Post-increment (x++): uses the value first, then increments

7. Ternary Operator: condition ? value_if_true : value_if_false
   - int max = (a > b) ? a : b;

Operator Precedence (highest to lowest):
() -> ++ -- -> * / % -> + - -> << >> -> < <= > >= -> == != -> & -> ^ -> | -> && -> || -> ?:

Control Flow Statements:

1. if-else Statement:
   if (condition) { ... }
   else if (condition) { ... }
   else { ... }

2. switch Statement:
   switch(expression) {
     case value1: ...; break;
     case value2: ...; break;
     default: ...;
   }
   - Expression must be int or char type
   - Without break, execution falls through to next case

3. while Loop: executes as long as condition is true
   while (condition) { ... }

4. do-while Loop: executes at least once, then checks condition
   do { ... } while (condition);

5. for Loop: for (init; condition; update) { ... }
   Example: for (int i = 0; i < 10; i++) { printf("%d ", i); }

6. break: exits the innermost loop or switch
7. continue: skips the rest of the current iteration
8. goto: jumps to a labeled statement (generally avoided)

Nested Loops:
A loop inside another loop. The inner loop executes completely for each iteration of the outer loop.
Total iterations = outer_iterations × inner_iterations`,
  },
  {
    title: 'Arrays and Strings',
    sort_order: 3,
    duration_minutes: 55,
    content_text: `C Programming — Arrays and Strings

Arrays:
An array is a collection of elements of the same data type stored in contiguous memory locations. Arrays allow you to store multiple values under a single variable name.

Declaration and Initialization:
int numbers[5];                    // Declaration (uninitialized)
int marks[5] = {90, 85, 78, 92, 88};  // Declaration with initialization
int values[] = {1, 2, 3, 4, 5};   // Size determined automatically
int zeros[10] = {0};              // All elements initialized to 0

Array Indexing:
- Arrays are zero-indexed: first element is at index 0, last at (size - 1)
- marks[0] = 90, marks[4] = 88
- Accessing out-of-bounds index causes undefined behavior (no runtime error in C)

Array Properties:
- Array name acts as a pointer to the first element
- Arrays cannot be resized after declaration
- Array size must be a constant expression (in standard C)
- sizeof(array) / sizeof(array[0]) gives the number of elements

Multidimensional Arrays:
int matrix[3][4];                  // 3 rows, 4 columns
int grid[2][3] = {{1,2,3}, {4,5,6}};

Accessing: matrix[row][col]
Memory layout: row-major order (elements of same row are contiguous)

Passing Arrays to Functions:
void printArray(int arr[], int size) { ... }
- Arrays are passed by reference (pointer to first element)
- Changes inside function affect the original array
- Size must be passed separately; sizeof inside function gives pointer size

Common Array Operations:
- Traversal: visiting each element using a loop
- Searching: Linear search O(n), Binary search O(log n) — requires sorted array
- Sorting: Bubble sort O(n²), Selection sort O(n²), Insertion sort O(n²)

Strings in C:
A string is an array of characters terminated by a null character '\\0'.

char name[20] = "Hello";          // Stored as: H, e, l, l, o, \\0
char greeting[] = "Hi";           // Size automatically set to 3
char str[10];
scanf("%s", str);                  // Reads string (stops at whitespace)
gets(str);                         // Reads entire line (unsafe, deprecated)
fgets(str, 10, stdin);            // Safe: reads up to 9 chars + \\0

String Library Functions (string.h):
- strlen(str): Returns length (excluding \\0)
- strcpy(dest, src): Copies src to dest
- strncpy(dest, src, n): Copies at most n characters
- strcat(dest, src): Concatenates src to end of dest
- strncat(dest, src, n): Concatenates at most n characters
- strcmp(s1, s2): Compares two strings. Returns 0 if equal, negative if s1 < s2, positive if s1 > s2
- strstr(haystack, needle): Finds first occurrence of needle in haystack
- strchr(str, ch): Finds first occurrence of character ch
- strtok(str, delimiters): Tokenizes string

Important: Always ensure destination buffer is large enough to prevent buffer overflow.
String comparison: Never use == to compare strings in C (compares addresses, not content). Always use strcmp().`,
  },
  {
    title: 'Pointers and Memory Management',
    sort_order: 4,
    duration_minutes: 60,
    content_text: `C Programming — Pointers and Dynamic Memory Management

Pointers:
A pointer is a variable that stores the memory address of another variable. Pointers are one of the most powerful and important features of C.

Declaration and Initialization:
int x = 10;
int *ptr = &x;     // ptr stores the address of x
printf("%d", *ptr); // Dereferencing: prints 10 (value at address)
printf("%p", ptr);  // Prints the address stored in ptr

Pointer Operators:
- & (address-of): Returns the memory address of a variable
- * (dereference/indirection): Accesses the value at the address stored in pointer

Pointer Arithmetic:
- ptr + 1: Moves to next element (adds sizeof(data_type) bytes)
- ptr - 1: Moves to previous element
- ptr2 - ptr1: Gives number of elements between two pointers
- Incrementing an int pointer adds 4 bytes (size of int)

Null Pointer:
int *ptr = NULL;  // Points to nothing (address 0)
Always check for NULL before dereferencing: if (ptr != NULL) { *ptr = 5; }

Pointer to Pointer (Double Pointer):
int x = 5;
int *p = &x;
int **pp = &p;    // pp points to p, which points to x
printf("%d", **pp); // prints 5

Pointers and Arrays:
- Array name is a constant pointer to the first element
- arr[i] is equivalent to *(arr + i)
- &arr[i] is equivalent to (arr + i)

Pointers and Functions:
Pass by reference using pointers allows functions to modify original values:
void swap(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

Function Pointers:
int (*funcPtr)(int, int);  // Pointer to function taking 2 ints, returning int
funcPtr = &add;
int result = funcPtr(3, 4);

Dynamic Memory Allocation (stdlib.h):
C provides four functions for dynamic memory management:

1. malloc(size): Allocates 'size' bytes. Returns void pointer. Memory is uninitialized.
   int *arr = (int *)malloc(5 * sizeof(int));

2. calloc(n, size): Allocates n elements of 'size' bytes each. Memory is initialized to 0.
   int *arr = (int *)calloc(5, sizeof(int));

3. realloc(ptr, new_size): Resizes previously allocated memory block.
   arr = (int *)realloc(arr, 10 * sizeof(int));

4. free(ptr): Deallocates previously allocated memory.
   free(arr);
   arr = NULL;  // Good practice: set to NULL after freeing

Memory Leaks:
Occur when dynamically allocated memory is not freed. The program loses the reference to the allocated memory, making it impossible to free. This wastes memory and can cause the program or system to run out of memory.

Common Pointer Mistakes:
- Dangling pointer: Pointer pointing to freed memory
- Wild pointer: Uninitialized pointer (points to random address)
- Memory leak: Forgetting to free allocated memory
- Double free: Freeing the same memory twice (undefined behavior)
- Buffer overflow: Writing beyond allocated memory bounds`,
  },
  {
    title: 'Structures and File Handling',
    sort_order: 5,
    duration_minutes: 50,
    content_text: `C Programming — Structures, Unions, and File Handling

Structures (struct):
A structure is a user-defined data type that groups related variables of different types under one name.

struct Student {
    char name[50];
    int roll_number;
    float gpa;
};

struct Student s1 = {"Alice", 101, 3.8};
printf("Name: %s, GPA: %.1f", s1.name, s1.gpa);

Accessing Members:
- Dot operator (.): s1.name for direct access
- Arrow operator (->): ptr->name when using pointer to structure

Structures and Pointers:
struct Student *ptr = &s1;
printf("Roll: %d", ptr->roll_number);  // Using arrow operator
printf("Roll: %d", (*ptr).roll_number); // Using dereference + dot

Nested Structures:
struct Address {
    char city[30];
    int pincode;
};
struct Employee {
    char name[50];
    struct Address addr;
};

typedef:
typedef struct {
    int x, y;
} Point;
Point p1 = {10, 20};  // No need to write 'struct' keyword

Unions:
Similar to structures but all members share the same memory location. Only one member can hold a value at a time. Size of union = size of largest member.

union Data {
    int i;
    float f;
    char c;
};
// sizeof(union Data) = sizeof(float) = 4 bytes

Enumerations (enum):
enum Color { RED, GREEN, BLUE };  // RED=0, GREEN=1, BLUE=2
enum Color c = GREEN;

File Handling:
C provides functions to create, read, write, and close files through the FILE pointer type.

Opening a File:
FILE *fp = fopen("data.txt", "r");  // Open for reading
Modes: "r" (read), "w" (write/create), "a" (append), "r+" (read+write), "w+" (write+read/create), "a+" (append+read)
Binary modes: "rb", "wb", "ab"

Reading from File:
- fgetc(fp): Reads one character
- fgets(buffer, size, fp): Reads a line
- fscanf(fp, format, ...): Formatted read
- fread(ptr, size, count, fp): Binary read

Writing to File:
- fputc(ch, fp): Writes one character
- fputs(str, fp): Writes a string
- fprintf(fp, format, ...): Formatted write
- fwrite(ptr, size, count, fp): Binary write

Closing: fclose(fp);
Always check if file opened successfully: if (fp == NULL) { perror("Error"); }

File Position:
- ftell(fp): Returns current position
- fseek(fp, offset, origin): Moves to specific position
  Origins: SEEK_SET (beginning), SEEK_CUR (current), SEEK_END (end)
- rewind(fp): Moves to beginning`,
  },
];

// ═══════════════════════════════════════════
// LESSONS — Python Programming
// ═══════════════════════════════════════════

const PYTHON_LESSONS = [
  {
    title: 'Python Basics & Data Types',
    sort_order: 1,
    duration_minutes: 40,
    content_text: `Python Programming — Introduction and Data Types

Python is a high-level, interpreted, general-purpose programming language created by Guido van Rossum and first released in 1991. Python emphasizes code readability with significant indentation and supports multiple programming paradigms including procedural, object-oriented, and functional programming.

Key Features of Python:
- Interpreted: Code is executed line by line (no compilation step)
- Dynamically typed: Variable types are determined at runtime
- Indentation-based: Uses whitespace indentation instead of braces
- Extensive standard library: "batteries included" philosophy
- Cross-platform: Runs on Windows, Mac, Linux

Python Data Types:

1. Numeric Types:
   - int: Integer of unlimited size. Example: x = 42, big = 999999999999999
   - float: Floating-point number. Example: pi = 3.14159
   - complex: Complex number. Example: z = 3 + 4j

2. String (str):
   - Sequence of characters enclosed in quotes
   - Single quotes: 'hello', Double quotes: "hello", Triple quotes: '''multiline'''
   - Immutable: cannot change individual characters
   - Indexing: s[0] (first char), s[-1] (last char)
   - Slicing: s[1:4] (chars at index 1,2,3), s[:3] (first 3), s[2:] (from index 2)
   - Common methods: .upper(), .lower(), .strip(), .split(), .join(), .replace(), .find(), .count()
   - f-strings: f"Name is {name}, age is {age}"
   - len(s) returns the length

3. Boolean (bool):
   - True or False (capitalized)
   - Falsy values: False, 0, 0.0, "", [], {}, None
   - All other values are truthy

4. None Type:
   - Represents absence of value
   - x = None
   - Check with: x is None (not x == None)

5. List:
   - Ordered, mutable collection. Can contain mixed types.
   - fruits = ["apple", "banana", "cherry"]
   - Access: fruits[0], fruits[-1]
   - Methods: .append(), .insert(), .remove(), .pop(), .sort(), .reverse(), .index(), .count()
   - List comprehension: squares = [x**2 for x in range(10)]

6. Tuple:
   - Ordered, immutable collection.
   - point = (10, 20)
   - Used for fixed collections, dictionary keys, function returns
   - Tuple unpacking: x, y = point

7. Dictionary (dict):
   - Key-value pairs. Keys must be immutable and unique.
   - person = {"name": "Alice", "age": 25}
   - Access: person["name"] or person.get("name", "default")
   - Methods: .keys(), .values(), .items(), .update(), .pop()
   - Dictionary comprehension: {x: x**2 for x in range(5)}

8. Set:
   - Unordered collection of unique elements.
   - colors = {"red", "green", "blue"}
   - Operations: union (|), intersection (&), difference (-), symmetric_difference (^)
   - Methods: .add(), .remove(), .discard()

Type Conversion:
int("42") -> 42, str(42) -> "42", float("3.14") -> 3.14
list("abc") -> ['a', 'b', 'c'], tuple([1,2,3]) -> (1,2,3)

Type Checking:
type(x) returns the type, isinstance(x, int) checks if x is an instance of int`,
  },
  {
    title: 'Functions and Modules',
    sort_order: 2,
    duration_minutes: 45,
    content_text: `Python Programming — Functions and Modules

Functions:
A function is a reusable block of code that performs a specific task. Functions help organize code, reduce repetition, and improve readability.

Defining Functions:
def greet(name):
    """This is a docstring - describes the function."""
    return f"Hello, {name}!"

message = greet("Alice")  # "Hello, Alice!"

Parameters and Arguments:
1. Positional arguments: def add(a, b): matched by position
2. Keyword arguments: add(b=3, a=5) — matched by name
3. Default parameters: def greet(name="World"): — used if no argument passed
4. *args: Variable positional arguments (received as tuple)
   def sum_all(*args): return sum(args)
5. **kwargs: Variable keyword arguments (received as dict)
   def info(**kwargs): for key, val in kwargs.items(): print(f"{key}: {val}")

Return Values:
- A function can return any type of value
- Multiple values can be returned as a tuple: return x, y, z
- Without return statement, function returns None

Scope:
- Local scope: Variables defined inside a function
- Global scope: Variables defined outside all functions
- global keyword: Allows modifying global variable inside function
- nonlocal keyword: Allows modifying enclosing function's variable

Lambda Functions:
Anonymous, single-expression functions.
square = lambda x: x ** 2
add = lambda a, b: a + b
sorted_list = sorted(names, key=lambda x: len(x))

Higher-Order Functions:
Functions that take other functions as arguments or return functions.

map(function, iterable): Applies function to each element
  list(map(str.upper, ["hello", "world"]))  # ["HELLO", "WORLD"]

filter(function, iterable): Filters elements where function returns True
  list(filter(lambda x: x > 0, [-1, 2, -3, 4]))  # [2, 4]

reduce(function, iterable): Reduces iterable to single value (from functools)
  from functools import reduce
  reduce(lambda a, b: a + b, [1, 2, 3, 4])  # 10

Decorators:
Functions that modify the behavior of other functions.
def timer(func):
    def wrapper(*args, **kwargs):
        import time
        start = time.time()
        result = func(*args, **kwargs)
        print(f"Took {time.time() - start:.2f}s")
        return result
    return wrapper

@timer
def slow_function():
    import time; time.sleep(1)

Modules and Packages:
- A module is a .py file containing Python code
- import math — imports entire module
- from math import sqrt, pi — imports specific items
- import numpy as np — imports with alias
- A package is a directory containing __init__.py and modules

Common Built-in Modules:
- math: sqrt, ceil, floor, pi, e, log, pow
- random: randint, choice, shuffle, random
- os: path operations, file system interaction
- sys: system-specific parameters, command-line args
- datetime: date and time manipulation
- json: JSON encoding/decoding
- re: Regular expressions`,
  },
  {
    title: 'Object-Oriented Programming in Python',
    sort_order: 3,
    duration_minutes: 55,
    content_text: `Python Programming — Object-Oriented Programming (OOP)

OOP is a programming paradigm based on the concept of objects that contain data (attributes) and code (methods). Python supports all four pillars of OOP.

Classes and Objects:
A class is a blueprint for creating objects. An object is an instance of a class.

class Student:
    # Class variable (shared by all instances)
    school = "Orbivex Academy"

    # Constructor (initializer)
    def __init__(self, name, age, grade):
        # Instance variables (unique to each object)
        self.name = name
        self.age = age
        self.grade = grade

    # Instance method
    def introduce(self):
        return f"I'm {self.name}, age {self.age}, grade {self.grade}"

    # String representation
    def __str__(self):
        return f"Student({self.name})"

s1 = Student("Alice", 20, "A")
print(s1.introduce())
print(Student.school)  # Access class variable

The self Parameter:
- First parameter of every instance method
- Refers to the current instance of the class
- Not a keyword, but a strong convention

Four Pillars of OOP:

1. ENCAPSULATION:
Bundling data and methods that operate on that data within a single unit (class). Access control through naming conventions:
- public: name (accessible from anywhere)
- protected: _name (convention: internal use, accessible but shouldn't be)
- private: __name (name mangling: _ClassName__name)

class BankAccount:
    def __init__(self, balance):
        self.__balance = balance  # Private

    def deposit(self, amount):
        if amount > 0:
            self.__balance += amount

    def get_balance(self):
        return self.__balance

    @property
    def balance(self):
        return self.__balance

2. INHERITANCE:
Creating a new class (child) from an existing class (parent). Child inherits all attributes and methods.

class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

class Student(Person):  # Student inherits from Person
    def __init__(self, name, age, student_id):
        super().__init__(name, age)  # Call parent constructor
        self.student_id = student_id

Types of inheritance:
- Single: class B(A)
- Multiple: class C(A, B) — Python supports this
- Multilevel: A -> B -> C
- Method Resolution Order (MRO): determines which method is called
  Use ClassName.mro() or ClassName.__mro__ to check

3. POLYMORPHISM:
Same interface, different implementations.
- Method overriding: Child class redefines parent method
- Duck typing: "If it walks like a duck and quacks like a duck, it's a duck"

class Dog:
    def speak(self): return "Woof!"

class Cat:
    def speak(self): return "Meow!"

def animal_sound(animal):
    print(animal.speak())  # Works for any object with speak() method

4. ABSTRACTION:
Hiding complex implementation details and showing only necessary features.

from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

    @abstractmethod
    def perimeter(self):
        pass

class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return 3.14159 * self.radius ** 2

    def perimeter(self):
        return 2 * 3.14159 * self.radius

Special (Magic/Dunder) Methods:
__init__: Constructor
__str__: String representation (for print)
__repr__: Official string representation
__len__: len(obj)
__eq__: obj1 == obj2
__lt__: obj1 < obj2
__add__: obj1 + obj2
__getitem__: obj[key]
__iter__: Makes object iterable`,
  },
  {
    title: 'Error Handling and File Operations',
    sort_order: 4,
    duration_minutes: 40,
    content_text: `Python Programming — Exception Handling and File I/O

Exception Handling:
Exceptions are runtime errors that can be handled gracefully using try-except blocks, preventing program crashes.

Basic Try-Except:
try:
    result = 10 / 0
except ZeroDivisionError:
    print("Cannot divide by zero!")

Multiple Except Blocks:
try:
    value = int(input("Enter number: "))
    result = 100 / value
except ValueError:
    print("Invalid input — not a number")
except ZeroDivisionError:
    print("Cannot divide by zero")
except Exception as e:
    print(f"Unexpected error: {e}")

Try-Except-Else-Finally:
try:
    file = open("data.txt", "r")
    content = file.read()
except FileNotFoundError:
    print("File not found")
else:
    print("File read successfully")  # Runs only if no exception
finally:
    print("This always runs")  # Cleanup code, runs no matter what

Common Built-in Exceptions:
- ValueError: Invalid value (int("hello"))
- TypeError: Wrong type operation ("hello" + 5)
- IndexError: List index out of range
- KeyError: Dictionary key not found
- FileNotFoundError: File doesn't exist
- ZeroDivisionError: Division by zero
- AttributeError: Non-existent attribute
- ImportError: Failed import
- NameError: Undefined variable
- RuntimeError: Generic runtime error

Raising Exceptions:
def set_age(age):
    if age < 0:
        raise ValueError("Age cannot be negative")
    return age

Custom Exceptions:
class InsufficientFundsError(Exception):
    def __init__(self, balance, amount):
        self.balance = balance
        self.amount = amount
        super().__init__(f"Cannot withdraw {amount}. Balance: {balance}")

File Operations:
Python provides built-in functions for file handling.

Opening Files:
f = open("file.txt", "r")  # Read mode
Modes: 'r' (read), 'w' (write/overwrite), 'a' (append), 'x' (create/fail if exists)
Add 'b' for binary: 'rb', 'wb'

Context Manager (recommended):
with open("file.txt", "r") as f:
    content = f.read()
# File automatically closed after the block

Reading:
f.read()        # Entire file as string
f.read(100)     # First 100 characters
f.readline()    # One line
f.readlines()   # List of all lines

Writing:
with open("output.txt", "w") as f:
    f.write("Hello World\\n")
    f.writelines(["Line 1\\n", "Line 2\\n"])

Working with CSV:
import csv
with open("data.csv", "r") as f:
    reader = csv.reader(f)
    for row in reader:
        print(row)

with open("output.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["Name", "Age"])
    writer.writerow(["Alice", 25])

Working with JSON:
import json
# Reading JSON
with open("data.json", "r") as f:
    data = json.load(f)

# Writing JSON
with open("output.json", "w") as f:
    json.dump(data, f, indent=2)

# String conversion
json_string = json.dumps(data)
data = json.loads(json_string)`,
  },
  {
    title: 'List Comprehensions and Advanced Data Structures',
    sort_order: 5,
    duration_minutes: 45,
    content_text: `Python Programming — Comprehensions, Iterators, and Advanced Data Structures

List Comprehensions:
A concise way to create lists using a single line of code.

Basic syntax: [expression for item in iterable if condition]

Examples:
squares = [x**2 for x in range(10)]        # [0, 1, 4, 9, 16, ...]
evens = [x for x in range(20) if x % 2 == 0]  # [0, 2, 4, 6, ...]
words = ["hello", "world"]
upper = [w.upper() for w in words]          # ["HELLO", "WORLD"]

Nested: matrix = [[i*j for j in range(5)] for i in range(5)]
Flattening: flat = [x for row in matrix for x in row]

Dictionary Comprehension:
{key: value for item in iterable if condition}
squares_dict = {x: x**2 for x in range(6)}  # {0:0, 1:1, 2:4, 3:9, 4:16, 5:25}

Set Comprehension:
unique_lengths = {len(word) for word in ["hello", "hi", "world"]}  # {2, 5}

Generator Expressions:
Like list comprehension but with () — produces values lazily (one at a time).
gen = (x**2 for x in range(1000000))  # No memory used until iterated
sum_squares = sum(x**2 for x in range(100))  # Direct use in functions

Iterators and Generators:
Iterator: An object with __iter__() and __next__() methods.
Generator: A function that uses yield instead of return.

def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

list(fibonacci(10))  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

Collections Module:
from collections import Counter, defaultdict, OrderedDict, deque, namedtuple

Counter: Counts occurrences of elements
  c = Counter("abracadabra")  # Counter({'a': 5, 'b': 2, 'r': 2, 'c': 1, 'd': 1})
  c.most_common(2)  # [('a', 5), ('b', 2)]

defaultdict: Dictionary with default value for missing keys
  dd = defaultdict(list)
  dd["fruits"].append("apple")  # No KeyError

deque: Double-ended queue (efficient append/pop from both ends)
  d = deque([1, 2, 3])
  d.appendleft(0)  # deque([0, 1, 2, 3])
  d.rotate(1)      # deque([3, 0, 1, 2])

namedtuple: Lightweight class for storing data
  Point = namedtuple('Point', ['x', 'y'])
  p = Point(10, 20)
  print(p.x, p.y)  # 10 20

Sorting:
sorted(iterable, key=None, reverse=False)
list.sort(key=None, reverse=False)  # In-place sort

students = [("Alice", 90), ("Bob", 75), ("Charlie", 85)]
sorted(students, key=lambda s: s[1], reverse=True)
# [("Alice", 90), ("Charlie", 85), ("Bob", 75)]

Enumerate and Zip:
for i, val in enumerate(["a", "b", "c"], start=1):
    print(f"{i}: {val}")

names = ["Alice", "Bob"]
scores = [90, 85]
for name, score in zip(names, scores):
    print(f"{name}: {score}")

Unpacking:
first, *rest = [1, 2, 3, 4, 5]  # first=1, rest=[2,3,4,5]
a, _, b = (1, 2, 3)              # Ignore middle value`,
  },
];

// ═══════════════════════════════════════════
// LESSONS — Aptitude & Logical Reasoning
// ═══════════════════════════════════════════

const APTITUDE_LESSONS = [
  {
    title: 'Number Systems and Divisibility',
    sort_order: 1,
    duration_minutes: 40,
    content_text: `Aptitude — Number Systems and Divisibility Rules

Types of Numbers:
1. Natural Numbers (N): 1, 2, 3, 4, ... (positive counting numbers)
2. Whole Numbers (W): 0, 1, 2, 3, ... (natural numbers + zero)
3. Integers (Z): ..., -2, -1, 0, 1, 2, ... (whole numbers + negatives)
4. Rational Numbers (Q): Numbers that can be expressed as p/q where q ≠ 0. Examples: 1/2, 3/4, -5/7, 0.75
5. Irrational Numbers: Cannot be expressed as p/q. Examples: √2, √3, π, e
6. Real Numbers (R): All rational and irrational numbers
7. Prime Numbers: Numbers with exactly 2 factors (1 and itself): 2, 3, 5, 7, 11, 13, 17, 19, 23, 29...
   Note: 2 is the only even prime number. 1 is neither prime nor composite.
8. Composite Numbers: Numbers with more than 2 factors: 4, 6, 8, 9, 10, 12...
9. Co-prime Numbers: Two numbers whose GCD (HCF) is 1. Example: 8 and 15
10. Perfect Numbers: Sum of proper divisors equals the number. Example: 6 = 1+2+3, 28 = 1+2+4+7+14

Divisibility Rules:
- By 2: Last digit is even (0, 2, 4, 6, 8)
- By 3: Sum of digits is divisible by 3. Example: 372 → 3+7+2 = 12 → divisible by 3
- By 4: Last two digits form a number divisible by 4. Example: 1324 → 24 ÷ 4 = 6 ✓
- By 5: Last digit is 0 or 5
- By 6: Divisible by both 2 and 3
- By 7: Double the last digit, subtract from remaining number. If result is divisible by 7, original is too.
  Example: 343 → 34 - 2×3 = 34-6 = 28 → 28÷7 = 4 ✓
- By 8: Last three digits form a number divisible by 8
- By 9: Sum of digits is divisible by 9. Example: 729 → 7+2+9 = 18 → 18÷9 = 2 ✓
- By 11: Difference between sum of digits at odd positions and even positions is 0 or divisible by 11
  Example: 121 → (1+1) - 2 = 0 ✓

HCF (Highest Common Factor) / GCD:
The largest number that divides two or more numbers exactly.
Methods: Prime factorization, Division method (Euclidean algorithm)
HCF of 12 and 18: 12 = 2² × 3, 18 = 2 × 3² → HCF = 2 × 3 = 6

LCM (Least Common Multiple):
The smallest number that is a multiple of two or more numbers.
LCM of 12 and 18: LCM = (12 × 18) / HCF = 216 / 6 = 36

Important Relationship: HCF × LCM = Product of two numbers (for two numbers only)

Remainder Theorem:
If N = D × Q + R, where D is divisor, Q is quotient, R is remainder:
- Remainder when dividing a sum: (R1 + R2) mod D
- Remainder when dividing a product: (R1 × R2) mod D

Unit Digit Patterns:
- Powers of 2 cycle: 2, 4, 8, 6 (cycle of 4)
- Powers of 3 cycle: 3, 9, 7, 1 (cycle of 4)
- Powers of 7 cycle: 7, 9, 3, 1 (cycle of 4)
- Any number ending in 0, 1, 5, 6 retains its unit digit for all powers`,
  },
  {
    title: 'Percentages, Profit & Loss',
    sort_order: 2,
    duration_minutes: 45,
    content_text: `Aptitude — Percentages, Profit and Loss

Percentages:
A percentage is a fraction expressed as a part of 100.
x% = x/100

Key Formulas:
- Percentage = (Value / Total) × 100
- Value = (Percentage / 100) × Total
- Percentage Change = ((New - Old) / Old) × 100

Fraction-Percentage Conversions (memorize these):
1/2 = 50%, 1/3 = 33.33%, 1/4 = 25%, 1/5 = 20%, 1/6 = 16.67%
1/7 = 14.28%, 1/8 = 12.5%, 1/9 = 11.11%, 1/10 = 10%, 1/11 = 9.09%, 1/12 = 8.33%

Successive Percentage Changes:
If value changes by a% then b%, net change = a + b + (ab/100)
Example: Price increases by 20% then decreases by 10%
Net = 20 + (-10) + (20 × -10)/100 = 20 - 10 - 2 = 8% increase

Population Problems:
After n years: P × (1 + r/100)^n (if increasing)
After n years: P × (1 - r/100)^n (if decreasing)

Profit and Loss:
Key Terms:
- Cost Price (CP): Price at which an article is bought
- Selling Price (SP): Price at which an article is sold
- Profit = SP - CP (when SP > CP)
- Loss = CP - SP (when CP > SP)
- Profit% = (Profit / CP) × 100
- Loss% = (Loss / CP) × 100

Important Formulas:
- SP = CP × (1 + Profit%/100) or SP = CP × (1 - Loss%/100)
- CP = SP / (1 + Profit%/100) or CP = SP / (1 - Loss%/100)
- If SP of X articles = CP of Y articles, then Profit% = ((Y-X)/X) × 100

Marked Price and Discount:
- Marked Price (MP): Listed/displayed price
- Discount = MP - SP
- Discount% = (Discount / MP) × 100
- SP = MP × (1 - Discount%/100)
- If Discount = d% and Profit = p%, then: MP = CP × (100 + p) / (100 - d)

Successive Discounts:
Two successive discounts of a% and b% is equivalent to:
Single discount = (a + b - ab/100)%
Example: Discounts of 20% and 10% = 20 + 10 - (20×10)/100 = 28%

Dishonest Dealer:
If a dealer uses a false weight of w grams instead of 1000 grams:
Profit% = ((1000 - w) / w) × 100

Partnership:
When two or more people invest in a business:
- If A invests ₹a for t1 months and B invests ₹b for t2 months:
  Ratio of profit = a × t1 : b × t2

Simple Interest vs Compound Interest:
SI = (P × R × T) / 100
CI = P × (1 + R/100)^T - P
Difference between CI and SI for 2 years = P × (R/100)²
Difference between CI and SI for 3 years = P × (R/100)² × (3 + R/100)`,
  },
  {
    title: 'Time, Speed & Distance',
    sort_order: 3,
    duration_minutes: 50,
    content_text: `Aptitude — Time, Speed, and Distance

Fundamental Formula:
Distance = Speed × Time
Speed = Distance / Time
Time = Distance / Speed

Unit Conversions:
- km/h to m/s: multiply by 5/18
- m/s to km/h: multiply by 18/5
- 1 km = 1000 m, 1 hour = 3600 seconds
- 36 km/h = 10 m/s, 72 km/h = 20 m/s

Average Speed:
- When same distance at speeds a and b: Average = 2ab/(a+b) (Harmonic mean)
- When same time at speeds a and b: Average = (a+b)/2 (Arithmetic mean)
- Average speed ≠ average of speeds (unless same time)

Relative Speed:
- Objects moving in same direction: Relative speed = |S1 - S2|
- Objects moving in opposite directions: Relative speed = S1 + S2

Trains:
- Time to pass a stationary object of length L: Time = (Train length + L) / Speed
- Time to pass a pole/person: Time = Train length / Speed
- Two trains crossing each other:
  Same direction: Time = (L1 + L2) / |S1 - S2|
  Opposite direction: Time = (L1 + L2) / (S1 + S2)

Boats and Streams:
- Downstream speed = Boat speed + Stream speed
- Upstream speed = Boat speed - Stream speed
- Speed of boat in still water = (Downstream + Upstream) / 2
- Speed of stream = (Downstream - Upstream) / 2

Circular Track:
- Two people starting from same point:
  Same direction: Meet after = Track length / |S1 - S2|
  Opposite direction: Meet after = Track length / (S1 + S2)
- First meeting point after start: proportional to their speeds

Races:
- If A beats B by x meters in a race of D meters:
  When A finishes D meters, B has covered (D - x) meters
  Ratio of speeds = D : (D - x)
- If A beats B by t seconds: B takes t seconds more than A to finish

Time and Work:
- If A can do work in x days, A's 1 day work = 1/x
- If A and B work together: 1/x + 1/y = 1/T (where T is combined time)
- A is twice as efficient as B means: A's rate = 2 × B's rate
- If M1 persons do W1 work in D1 days working H1 hours/day:
  M1 × D1 × H1 / W1 = M2 × D2 × H2 / W2

Pipes and Cisterns:
- Inlet pipe fills in x hours: rate = 1/x per hour
- Outlet pipe empties in y hours: rate = 1/y per hour
- Combined rate (inlet + outlet) = 1/x - 1/y
- If pipe fills in x hours and another empties in y hours (x < y): Tank fills in xy/(y-x) hours`,
  },
  {
    title: 'Probability and Permutations',
    sort_order: 4,
    duration_minutes: 50,
    content_text: `Aptitude — Probability, Permutations and Combinations

Permutations (Arrangements):
Order matters. nPr = n! / (n-r)!

Factorial: n! = n × (n-1) × (n-2) × ... × 1
0! = 1, 1! = 1

Examples:
- Number of ways to arrange 5 books on a shelf: 5! = 120
- Number of 3-letter words from ABCDE (no repetition): 5P3 = 60
- Circular permutation of n objects: (n-1)!
  Arranging 6 people around a round table: 5! = 120

Special Cases:
- Permutations with repetition: n^r (r items from n, repetition allowed)
- Permutations of n objects where p are identical, q are identical: n! / (p! × q!)
  Example: Arrangements of "MISSISSIPPI": 11! / (4! × 4! × 2!) = 34,650

Combinations (Selections):
Order doesn't matter. nCr = n! / (r! × (n-r)!)

Properties:
- nC0 = nCn = 1
- nCr = nC(n-r)
- nCr + nC(r-1) = (n+1)Cr (Pascal's rule)

Examples:
- Selecting 3 students from 10: 10C3 = 120
- Handshakes among 8 people: 8C2 = 28
- Diagonals of a polygon with n sides: nC2 - n = n(n-3)/2

Probability:
P(Event) = Number of favorable outcomes / Total number of outcomes
- 0 ≤ P(A) ≤ 1
- P(A) + P(A') = 1 (complement rule)
- P(A') = 1 - P(A)

Types of Events:
- Independent: P(A and B) = P(A) × P(B)
- Mutually exclusive: P(A or B) = P(A) + P(B), P(A and B) = 0
- General addition: P(A or B) = P(A) + P(B) - P(A and B)

Conditional Probability:
P(A|B) = P(A and B) / P(B)

Dice Probability:
- Single die: Total outcomes = 6
  P(getting 4) = 1/6
  P(even number) = 3/6 = 1/2
- Two dice: Total outcomes = 36
  P(sum = 7) = 6/36 = 1/6
  P(sum = 2) = 1/36 (only 1+1)
  P(sum = 12) = 1/36 (only 6+6)
  P(doublet) = 6/36 = 1/6

Card Probability:
52 cards: 4 suits (Hearts♥, Diamonds♦, Clubs♣, Spades♠), 13 cards each
- P(king) = 4/52 = 1/13
- P(red card) = 26/52 = 1/2
- P(face card) = 12/52 = 3/13 (J, Q, K of each suit)
- P(ace of spades) = 1/52

Coin Probability:
- Single toss: P(head) = 1/2
- n tosses: Total outcomes = 2^n
  P(exactly k heads in n tosses) = nCk × (1/2)^n

Bayes' Theorem:
P(A|B) = P(B|A) × P(A) / P(B)`,
  },
  {
    title: 'Ratio, Proportion and Averages',
    sort_order: 5,
    duration_minutes: 40,
    content_text: `Aptitude — Ratio, Proportion, Mixtures and Averages

Ratio:
A ratio compares two quantities by division. Ratio of a to b = a:b = a/b.

Properties:
- a:b = ka:kb (multiplying both by same number doesn't change ratio)
- If a:b = 2:3 and b:c = 4:5, then a:b:c = 8:12:15 (equalize b: 2×4:3×4:3×5)
- If a:b = p:q, then a = pk/(p+q) × Total, b = qk/(p+q) × Total

Proportion:
If a/b = c/d, then a, b, c, d are in proportion. Written as a:b :: c:d

Properties of Proportion:
- Product of means = Product of extremes: b × c = a × d
- Componendo: (a+b)/b = (c+d)/d
- Dividendo: (a-b)/b = (c-d)/d
- Componendo-Dividendo: (a+b)/(a-b) = (c+d)/(c-d)

Mean Proportional: If a:x :: x:b, then x = √(ab)
Third Proportional: If a:b :: b:c, then c = b²/a

Mixtures and Alligation:
Rule of alligation is used to find the ratio in which two quantities at different prices/concentrations must be mixed.

If C₁ and C₂ are concentrations and Cm is mixture concentration:
Quantity₁ / Quantity₂ = (C₂ - Cm) / (Cm - C₁)

Alligation Cross Method:
  C₁          C₂
      \\    /
       Cm
      /    \\
(C₂-Cm) : (Cm-C₁)

Example: Mix milk at ₹60/L with milk at ₹40/L to get mixture at ₹52/L.
Ratio = (60-52):(52-40) = 8:12 = 2:3

Replacement Problems:
If a container has M liters and x liters are removed and replaced with water:
After n operations: Amount of original liquid = M × (1 - x/M)^n

Averages:
Average = Sum of all values / Number of values

Properties:
- If average of n numbers is A, sum = n × A
- If one number is added: New average = (nA + new_number) / (n+1)
- If one number is removed: New average = (nA - removed_number) / (n-1)
- Weighted average: (w₁x₁ + w₂x₂ + ...) / (w₁ + w₂ + ...)

Age Problems:
- If average age of family of n members is A years:
  Sum of ages = n × A
- Average increases by k years after t years: Each person ages t years
  New average = A + t
- If a new member joins/leaves, use the sum method

Median: Middle value when arranged in order
  For odd n: (n+1)/2 th term
  For even n: Average of n/2 th and (n/2 + 1) th terms

Mode: Most frequently occurring value

Arithmetic Progression (AP):
a, a+d, a+2d, a+3d, ...
nth term: an = a + (n-1)d
Sum of n terms: Sn = n/2 × [2a + (n-1)d] = n/2 × (first + last)

Geometric Progression (GP):
a, ar, ar², ar³, ...
nth term: an = a × r^(n-1)
Sum of n terms: Sn = a(r^n - 1)/(r - 1) for r > 1
Sum of infinite GP (|r| < 1): S∞ = a/(1-r)`,
  },
];

// ═══════════════════════════════════════════
// LESSONS — Verbal Ability
// ═══════════════════════════════════════════

const VERBAL_LESSONS = [
  {
    title: 'Parts of Speech and Tenses',
    sort_order: 1,
    duration_minutes: 40,
    content_text: `Verbal Ability — Parts of Speech and Tenses

Parts of Speech:
Every word in English belongs to one of eight parts of speech based on its function in a sentence.

1. NOUN — Names a person, place, thing, or idea.
   Types: Common (city, dog), Proper (Mumbai, Rex), Abstract (love, freedom), Collective (team, flock), Material (gold, water)
   Countable: book/books, child/children
   Uncountable: information, furniture, advice, luggage (no plural form)

2. PRONOUN — Replaces a noun. Types: Personal (I, you, he, she, it, we, they), Possessive (mine, yours, his), Reflexive (myself, yourself), Relative (who, which, that), Demonstrative (this, that, these, those), Indefinite (anyone, everybody, something)

3. VERB — Shows action or state of being. Main verbs (run, eat) and Helping/Auxiliary verbs (is, am, are, was, were, have, has, had, do, does, did, shall, will, can, may, might, must, should, would, could)

4. ADJECTIVE — Describes/modifies a noun. Order: Opinion-Size-Age-Shape-Color-Origin-Material-Purpose. Example: "a beautiful large old round red Italian leather dining table"

5. ADVERB — Modifies a verb, adjective, or another adverb. Types: Manner (quickly), Place (here), Time (yesterday), Frequency (always), Degree (very, quite)

6. PREPOSITION — Shows relationship between noun/pronoun and other words. In, on, at, by, for, with, from, to, about, between, among, through, during, before, after

7. CONJUNCTION — Connects words, phrases, or clauses. Coordinating (FANBOYS: for, and, nor, but, or, yet, so), Subordinating (because, although, while, if, when, after, before, until)

8. INTERJECTION — Expresses emotion. Oh!, Wow!, Alas!, Hurray!

Tenses:
English has 12 tenses (3 times × 4 aspects):

PRESENT:
- Simple Present: Subject + V1 (He plays cricket daily)
  Use: Habits, general truths, scheduled events
- Present Continuous: Subject + is/am/are + V-ing (She is reading now)
  Use: Actions happening now, temporary situations
- Present Perfect: Subject + has/have + V3 (I have finished my work)
  Use: Past action with present relevance, experiences
- Present Perfect Continuous: Subject + has/have + been + V-ing (They have been waiting for 2 hours)
  Use: Actions started in past, still continuing

PAST:
- Simple Past: Subject + V2 (He played yesterday)
  Use: Completed past actions
- Past Continuous: Subject + was/were + V-ing (She was reading when I called)
  Use: Ongoing past action, interrupted action
- Past Perfect: Subject + had + V3 (I had finished before he came)
  Use: Action completed before another past action
- Past Perfect Continuous: Subject + had + been + V-ing (They had been waiting for 2 hours when the bus arrived)

FUTURE:
- Simple Future: Subject + will/shall + V1 (I will go tomorrow)
- Future Continuous: Subject + will be + V-ing (She will be studying at 8 PM)
- Future Perfect: Subject + will have + V3 (I will have finished by then)
- Future Perfect Continuous: Subject + will have been + V-ing (By 2025, I will have been working here for 5 years)

Common Errors:
- "I am having a car" ✗ → "I have a car" ✓ (stative verbs don't use continuous)
- "He has went" ✗ → "He has gone" ✓ (use V3 with has/have)
- "I didn't went" ✗ → "I didn't go" ✓ (use V1 after did/didn't)`,
  },
  {
    title: 'Subject-Verb Agreement and Common Errors',
    sort_order: 2,
    duration_minutes: 45,
    content_text: `Verbal Ability — Subject-Verb Agreement and Error Spotting

Subject-Verb Agreement Rules:
The verb must agree with the subject in number (singular/plural) and person.

Rule 1: Singular subject takes singular verb; plural subject takes plural verb.
"The boy runs." (singular) / "The boys run." (plural)

Rule 2: When subjects are joined by "and", use plural verb.
"Tom and Jerry are friends."
Exception: When they refer to the same person/thing: "Bread and butter is my breakfast."

Rule 3: When subjects are joined by "or", "nor", "either...or", "neither...nor", the verb agrees with the nearer subject.
"Neither the teacher nor the students were present."
"Either the students or the teacher was present."

Rule 4: Collective nouns take singular verb when acting as one unit, plural when acting as individuals.
"The team is winning." (acting as unit) / "The team are arguing among themselves." (acting as individuals)

Rule 5: "Each", "every", "everyone", "everybody", "anyone", "anybody", "no one", "nobody" take singular verb.
"Each of the students has a book." / "Everyone is present."

Rule 6: "Some of", "most of", "all of", "none of" — verb depends on the noun that follows.
"Some of the water is dirty." / "Some of the books are missing."

Rule 7: "A number of" takes plural verb; "The number of" takes singular verb.
"A number of students are absent." / "The number of students is fifty."

Rule 8: Titles, distances, amounts (as a single unit) take singular verb.
"Three miles is a long walk." / "Five hundred rupees is a good amount."

Rule 9: "Along with", "together with", "as well as", "besides", "in addition to" do NOT change the subject.
"The teacher, along with the students, was present." (teacher is the subject)

Rule 10: Uncountable nouns always take singular verb.
"The information is correct." / "The furniture was expensive."

Common Grammar Errors:

1. Pronoun errors:
"Each student should bring their book" ✗ → "Each student should bring his/her book" ✓
"Between you and I" ✗ → "Between you and me" ✓ (object of preposition)

2. Misplaced modifiers:
"Running down the street, the tree tripped me" ✗ → "Running down the street, I tripped over a tree root" ✓

3. Dangling participles:
"Having finished lunch, the book was picked up" ✗ → "Having finished lunch, I picked up the book" ✓

4. Parallel structure:
"She likes swimming, jogging, and to cycle" ✗ → "She likes swimming, jogging, and cycling" ✓

5. Double negatives:
"I don't have no money" ✗ → "I don't have any money" ✓

6. Confusing words:
- affect (verb) vs effect (noun): "The decision affected the outcome." / "The effect was immediate."
- their (possessive) vs there (place) vs they're (they are)
- its (possessive) vs it's (it is)
- lose (verb) vs loose (adjective)
- than (comparison) vs then (time)
- principle (rule) vs principal (chief/head)
- stationary (not moving) vs stationery (writing materials)`,
  },
  {
    title: 'Reading Comprehension Strategies',
    sort_order: 3,
    duration_minutes: 45,
    content_text: `Verbal Ability — Reading Comprehension (RC) Strategies

Reading Comprehension tests your ability to understand, analyze, and interpret written passages. RC questions typically make up 30-40% of verbal ability sections in competitive exams.

Types of RC Questions:

1. Main Idea / Central Theme:
   - What is the passage mainly about?
   - Which title best suits the passage?
   Strategy: The main idea is usually stated in the first or last paragraph. Look for the topic sentence that summarizes the entire passage.

2. Detail/Fact-based Questions:
   - According to the passage, which statement is true?
   - The author mentions X in the context of...
   Strategy: Scan for specific keywords from the question. Answer is directly stated in the passage.

3. Inference Questions:
   - It can be inferred from the passage that...
   - The author implies that...
   Strategy: The answer is NOT directly stated. You must draw a logical conclusion from the given information. Avoid extreme inferences.

4. Vocabulary in Context:
   - The word "X" as used in the passage most nearly means...
   Strategy: Don't rely on dictionary meaning. Read the sentence and surrounding sentences to determine contextual meaning.

5. Tone / Attitude:
   - The author's tone can be described as...
   - The author's attitude toward X is...
   Common tones: Objective, Subjective, Critical, Appreciative, Sarcastic, Satirical, Analytical, Persuasive, Neutral, Optimistic, Pessimistic, Nostalgic

6. Purpose Questions:
   - The author mentions X in order to...
   - The purpose of the third paragraph is to...
   Strategy: Think about WHY the author included that information.

7. Strengthen / Weaken:
   - Which of the following would weaken the author's argument?
   Strategy: Identify the author's claim, then find what contradicts or supports it.

Reading Strategies:
1. Skim first: Read the passage quickly to get the overall structure and main idea (2-3 minutes)
2. Read questions: Know what to look for before detailed reading
3. Read carefully: Focus on paragraphs relevant to questions
4. Eliminate options: Use process of elimination
5. Don't assume: Answer based only on what's in the passage, not your knowledge
6. Watch for traps: "All of the above", "None of the above", extreme words (always, never, only)

Common Passage Types:
1. Science/Technology: Factual, objective, cause-effect reasoning
2. Social Issues: Argumentative, multiple perspectives
3. History/Culture: Narrative, chronological structure
4. Philosophy/Abstract: Complex ideas, theoretical concepts
5. Economics/Business: Data-driven, analytical

Paragraph Structure:
- Topic sentence: States the main point (usually first sentence)
- Supporting sentences: Provide evidence, examples, details
- Concluding sentence: Summarizes or transitions

Signal Words:
- Addition: furthermore, moreover, in addition, also
- Contrast: however, nevertheless, on the other hand, although, despite
- Cause-Effect: therefore, consequently, as a result, because, since
- Example: for instance, for example, such as, specifically
- Conclusion: in conclusion, ultimately, to sum up, hence`,
  },
  {
    title: 'Synonyms, Antonyms and Vocabulary',
    sort_order: 4,
    duration_minutes: 40,
    content_text: `Verbal Ability — Vocabulary Building: Synonyms, Antonyms, and Word Usage

Synonyms (words with similar meaning):

Common Synonym Pairs:
- Abandon: forsake, relinquish, desert, discard
- Abundant: plentiful, copious, ample, profuse
- Accurate: precise, exact, correct, meticulous
- Admire: appreciate, esteem, respect, revere
- Brave: courageous, valiant, intrepid, gallant, fearless
- Brief: concise, succinct, short, terse
- Calm: serene, tranquil, placid, composed
- Clever: intelligent, astute, shrewd, ingenious
- Decrease: diminish, reduce, decline, dwindle, wane
- Difficult: arduous, strenuous, laborious, onerous
- Eager: enthusiastic, keen, zealous, fervent
- Famous: renowned, celebrated, eminent, illustrious, distinguished
- Generous: magnanimous, benevolent, munificent, liberal
- Happy: elated, jubilant, ecstatic, blissful, euphoric
- Important: crucial, vital, significant, paramount, pivotal
- Lazy: indolent, slothful, lethargic, languid
- Old: ancient, archaic, antiquated, obsolete

Antonyms (words with opposite meaning):

Common Antonym Pairs:
- Accept / Reject, Refuse, Decline
- Advance / Retreat, Recede
- Ancient / Modern, Contemporary
- Artificial / Natural, Genuine
- Benevolent / Malevolent, Malicious
- Bold / Timid, Cowardly, Meek
- Complicated / Simple, Straightforward
- Create / Destroy, Demolish
- Diligent / Lazy, Negligent
- Enormous / Tiny, Minuscule
- Flourish / Wither, Decline, Perish
- Genuine / Fake, Counterfeit, Spurious
- Hostile / Friendly, Amicable
- Ignore / Acknowledge, Notice
- Joy / Sorrow, Grief, Despair

Prefixes that create antonyms:
- un-: happy/unhappy, fair/unfair, able/unable
- in-/im-/il-/ir-: visible/invisible, possible/impossible, legal/illegal, regular/irregular
- dis-: agree/disagree, appear/disappear, honest/dishonest
- mis-: understand/misunderstand, lead/mislead
- non-: sense/nonsense, fiction/nonfiction

Important Vocabulary for Competitive Exams:

Positive Words:
Altruistic (selfless), Benign (gentle, harmless), Candid (honest, frank), Diligent (hardworking), Eloquent (fluent in speech), Gregarious (sociable), Meticulous (very careful), Pragmatic (practical), Resilient (able to recover), Tenacious (persistent)

Negative Words:
Arrogant (proud), Belligerent (aggressive), Callous (insensitive), Cynical (distrustful), Deceitful (dishonest), Frivolous (not serious), Lethargic (lacking energy), Mundane (dull, ordinary), Ostentatious (showy), Vindictive (seeking revenge)

Neutral / Descriptive Words:
Ambiguous (having double meaning), Contemporary (belonging to same time), Ephemeral (lasting very short time), Inevitable (cannot be avoided), Novice (beginner), Plausible (seeming reasonable), Prolific (producing much), Rhetoric (art of persuasive speaking), Subtle (not obvious), Ubiquitous (found everywhere)

One-Word Substitutions:
- A person who loves books: Bibliophile
- Fear of heights: Acrophobia
- Fear of closed spaces: Claustrophobia
- Study of stars: Astronomy
- Killing of a king: Regicide
- Government by the rich: Plutocracy
- A speech made without preparation: Extempore
- Something that cannot be erased: Indelible
- A person who speaks many languages: Polyglot
- Writing that cannot be read: Illegible`,
  },
  {
    title: 'Sentence Correction and Para Jumbles',
    sort_order: 5,
    duration_minutes: 45,
    content_text: `Verbal Ability — Sentence Correction, Sentence Completion, and Para Jumbles

Sentence Correction:
Identify and fix grammatical errors in sentences. Common error types:

1. Subject-Verb Agreement:
   ✗ "The list of items are on the table."
   ✓ "The list of items is on the table." (subject is 'list', not 'items')

2. Tense Consistency:
   ✗ "She went to the market and buys vegetables."
   ✓ "She went to the market and bought vegetables."

3. Pronoun Reference:
   ✗ "When John met Bob, he was very happy." (who is 'he'?)
   ✓ "When John met Bob, John was very happy."

4. Parallelism:
   ✗ "He likes reading, writing, and to paint."
   ✓ "He likes reading, writing, and painting."

5. Redundancy:
   ✗ "Return back", "Revert back", "Free gift", "Advance planning", "Past history"
   ✓ "Return", "Revert", "Gift", "Planning", "History"

6. Idiom Usage:
   ✗ "He died from cancer."
   ✓ "He died of cancer."
   Common: "Interested in" (not "interested for"), "Different from" (not "different than"), "Consists of" (not "consists in"), "Superior to" (not "superior than")

Sentence Completion (Fill in the Blanks):
Choose the word/phrase that best completes the sentence.

Strategy:
1. Read the entire sentence to understand context
2. Look for clue words (however, although, because, therefore)
3. Determine if blank needs positive/negative word
4. Check grammatical fit (noun, verb, adjective?)
5. Eliminate clearly wrong options

Signal Words:
- Contrast signals (but, however, although, despite, yet) → opposite meaning expected
- Support signals (and, moreover, furthermore, also) → similar meaning expected
- Cause signals (because, since, therefore, hence) → logical consequence

Para Jumbles:
Rearrange jumbled sentences to form a coherent paragraph.

Strategy:
1. Find the opening sentence: Usually introduces the topic, contains no pronoun references to previous sentences, often the most general statement.

2. Find the closing sentence: Usually concludes, summarizes, or gives the final point.

3. Look for mandatory pairs: Find sentences that MUST go together:
   - Pronoun references: "He", "She", "It", "They", "This", "That" must follow the noun they refer to
   - Articles: "The" usually refers to something already mentioned
   - Conjunctions: "However", "Therefore", "Moreover" connect to a previous idea

4. Follow logical flow:
   - General → Specific
   - Cause → Effect
   - Problem → Solution
   - Chronological order (dates, time words)
   - Idea introduction → Example → Conclusion

5. Eliminate options: In MCQ format, find the first sentence and eliminate options that don't start with it.

Common Linking Devices:
- Time order: First, Then, Next, Finally, Subsequently, Meanwhile
- Addition: Furthermore, Moreover, In addition, Also, Besides
- Contrast: However, Nevertheless, On the other hand, Conversely
- Example: For instance, For example, Such as, Namely
- Result: Therefore, Hence, Consequently, As a result
- Summary: In conclusion, To summarize, Overall, In short

Practice Tips:
- Read the first and last options — they're often easiest to identify
- Look for transition words at the beginning of sentences
- Track pronoun references carefully
- Check that the final order reads naturally and logically`,
  },
];

// ═══════════════════════════════════════════
// SEED FUNCTION
// ═══════════════════════════════════════════

async function seedLessons() {
  console.log('Seeding example courses and lessons for AI Question Generation...\n');

  // Get admin user to set as creator
  const { data: admin } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();

  const createdBy = admin?.id || null;

  const courseMap = {};

  // Create courses
  for (const course of COURSES) {
    const { data, error } = await supabase
      .from('courses')
      .insert({ ...course, created_by: createdBy, is_published: true })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        console.log(`  [skip] Course "${course.title}" — already exists`);
        const { data: existing } = await supabase
          .from('courses')
          .select('id')
          .eq('title', course.title)
          .single();
        if (existing) courseMap[course.title] = existing.id;
        continue;
      }
      console.error(`  [error] Course "${course.title}": ${error.message}`);
      continue;
    }
    courseMap[course.title] = data.id;
    console.log(`  [created] Course: ${course.title}`);
  }

  // Lesson mappings
  const lessonSets = [
    { courseTitle: 'C Programming Fundamentals', lessons: C_LESSONS },
    { courseTitle: 'Python Programming', lessons: PYTHON_LESSONS },
    { courseTitle: 'Aptitude & Logical Reasoning', lessons: APTITUDE_LESSONS },
    { courseTitle: 'Verbal Ability & Communication', lessons: VERBAL_LESSONS },
  ];

  for (const { courseTitle, lessons } of lessonSets) {
    const courseId = courseMap[courseTitle];
    if (!courseId) {
      console.log(`  [skip] Lessons for "${courseTitle}" — course not found`);
      continue;
    }

    for (const lesson of lessons) {
      const { error } = await supabase
        .from('lessons')
        .insert({ ...lesson, course_id: courseId })
        .select()
        .single();

      if (error) {
        if (error.message.includes('duplicate')) {
          console.log(`    [skip] "${lesson.title}" — already exists`);
        } else {
          console.error(`    [error] "${lesson.title}": ${error.message}`);
        }
        continue;
      }
      console.log(`    [created] Lesson: ${lesson.title} (${lesson.content_text.length} chars)`);
    }
  }

  console.log('\n--- Summary ---');
  console.log('Courses created: 4');
  console.log('  TECHNICAL: C Programming (5 lessons), Python Programming (5 lessons)');
  console.log('  NON-TECH:  Aptitude & Reasoning (5 lessons), Verbal Ability (5 lessons)');
  console.log('\nTo generate questions:');
  console.log('  1. Go to Admin Dashboard → Tests & Questions → Question Bank');
  console.log('  2. Click "AI Generate" button');
  console.log('  3. Select a lesson and number of questions');
  console.log('  4. Click Generate — questions are saved to the bank');
  console.log('\nDone!');
}

seedLessons().catch(console.error);
