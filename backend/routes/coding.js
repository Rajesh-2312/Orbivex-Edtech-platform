/**
 * Orbivex — DSA Coding Practice Routes
 * Problem bank, attempt tracking, AI hints
 * GET  /api/coding/problems          — list with filters
 * GET  /api/coding/problems/:id      — single problem
 * POST /api/coding/problems/:id/hint — AI hint
 * POST /api/coding/attempt           — save attempt
 * GET  /api/coding/progress          — user's topic-wise progress
 */
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { generateCompletion } = require('../config/ai');
const { success, error } = require('../utils/response');

/* ──────────────────────────────────────────────
   SEED PROBLEMS (used for seeding DB on first run)
────────────────────────────────────────────── */
const SEED_PROBLEMS = [
  // ── ARRAYS ──
  { slug:'two-sum', topic:'Arrays', title:'Two Sum', difficulty:'Easy', description:`Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers that add up to the target.\n\n**Example:**\n\`\`\`\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]  // nums[0]+nums[1] = 9\n\`\`\``, constraints:'2 ≤ nums.length ≤ 10⁴, answer exists and is unique', hint_topic:'HashMap / dictionary for O(n) lookup', companies:['TCS','Infosys','Wipro'], tags:['hashmap','array'] },
  { slug:'max-subarray', topic:'Arrays', title:'Maximum Subarray (Kadane\'s)', difficulty:'Medium', description:`Find the contiguous subarray with the largest sum.\n\n**Example:**\n\`\`\`\nInput: [-2,1,-3,4,-1,2,1,-5,4]\nOutput: 6  // subarray [4,-1,2,1]\n\`\`\``, constraints:'-10⁴ ≤ nums[i] ≤ 10⁴', hint_topic:'Kadane\'s Algorithm — maintain currentMax and globalMax', companies:['Amazon','Microsoft','TCS'], tags:['dp','array'] },
  { slug:'rotate-array', topic:'Arrays', title:'Rotate Array by K', difficulty:'Easy', description:`Given an array, rotate it to the right by k steps.\n\n**Example:**\n\`\`\`\nInput: nums = [1,2,3,4,5,6,7], k = 3\nOutput: [5,6,7,1,2,3,4]\n\`\`\``, constraints:'1 ≤ k ≤ 10⁵', hint_topic:'Reverse the full array, then reverse first k, then reverse rest', companies:['Infosys','Capgemini'], tags:['array','in-place'] },
  { slug:'best-time-stock', topic:'Arrays', title:'Best Time to Buy and Sell Stock', difficulty:'Easy', description:`Given prices array, find max profit you can achieve by buying on one day and selling later.\n\n**Example:**\n\`\`\`\nInput: [7,1,5,3,6,4]\nOutput: 5  // Buy at 1, sell at 6\n\`\`\``, constraints:'1 ≤ prices.length ≤ 10⁵', hint_topic:'Track minimum price seen so far, update max profit at each step', companies:['Goldman Sachs','JP Morgan','TCS'], tags:['greedy','array'] },
  { slug:'merge-intervals', topic:'Arrays', title:'Merge Overlapping Intervals', difficulty:'Medium', description:`Given array of intervals, merge all overlapping intervals.\n\n**Example:**\n\`\`\`\nInput: [[1,3],[2,6],[8,10],[15,18]]\nOutput: [[1,6],[8,10],[15,18]]\n\`\`\``, constraints:'1 ≤ intervals.length ≤ 10⁴', hint_topic:'Sort by start time, then greedily merge', companies:['Microsoft','Google','Zoho'], tags:['sorting','greedy'] },
  { slug:'missing-number', topic:'Arrays', title:'Find Missing Number', difficulty:'Easy', description:`Given array of n distinct numbers in range [0,n], find the missing one.\n\n**Example:**\n\`\`\`\nInput: [3,0,1]\nOutput: 2\n\`\`\``, constraints:'n = nums.length', hint_topic:'Expected sum = n*(n+1)/2, subtract actual sum', companies:['TCS','Wipro','Cognizant'], tags:['math','array'] },
  { slug:'find-duplicate', topic:'Arrays', title:'Find the Duplicate Number', difficulty:'Medium', description:`Given n+1 integers in range [1,n], find the duplicate. Only one duplicate exists.\n\n**Example:**\n\`\`\`\nInput: [1,3,4,2,2]\nOutput: 2\n\`\`\``, constraints:'Must use O(1) space', hint_topic:'Floyd\'s Tortoise and Hare cycle detection', companies:['Adobe','Amazon'], tags:['two-pointers','cycle-detection'] },

  // ── STRINGS ──
  { slug:'valid-anagram', topic:'Strings', title:'Valid Anagram', difficulty:'Easy', description:`Given two strings s and t, return true if t is an anagram of s.\n\n**Example:**\n\`\`\`\nInput: s="anagram", t="nagaram"\nOutput: true\n\`\`\``, constraints:'1 ≤ s.length,t.length ≤ 5×10⁴', hint_topic:'Count character frequencies using a hashmap', companies:['TCS','Infosys','Accenture'], tags:['hashmap','string'] },
  { slug:'longest-palindrome', topic:'Strings', title:'Longest Palindromic Substring', difficulty:'Medium', description:`Find the longest palindromic substring in string s.\n\n**Example:**\n\`\`\`\nInput: "babad"\nOutput: "bab" or "aba"\n\`\`\``, constraints:'1 ≤ s.length ≤ 1000', hint_topic:'Expand around center approach — O(n²) time, O(1) space', companies:['Google','Amazon','Zoho'], tags:['dp','string'] },
  { slug:'valid-parentheses', topic:'Strings', title:'Valid Parentheses', difficulty:'Easy', description:`Given a string containing just (){}[], determine if it is valid.\n\n**Example:**\n\`\`\`\nInput: "()[]{}" → Output: true\nInput: "(]"     → Output: false\n\`\`\``, constraints:'1 ≤ s.length ≤ 10⁴', hint_topic:'Stack: push open brackets, pop and match on close', companies:['TCS','Wipro','Microsoft'], tags:['stack','string'] },
  { slug:'reverse-words', topic:'Strings', title:'Reverse Words in a String', difficulty:'Easy', description:`Reverse the order of words in a string (trim extra spaces).\n\n**Example:**\n\`\`\`\nInput: "  hello world  "\nOutput: "world hello"\n\`\`\``, constraints:'1 ≤ s.length ≤ 10⁴', hint_topic:'Split by whitespace, reverse array, join with single space', companies:['Infosys','Capgemini','TCS'], tags:['string','two-pointers'] },
  { slug:'roman-to-int', topic:'Strings', title:'Roman to Integer', difficulty:'Easy', description:`Convert a Roman numeral string to integer.\n\n**Example:**\n\`\`\`\nInput: "III"  → Output: 3\nInput: "IV"   → Output: 4\nInput: "MCMXCIV" → Output: 1994\n\`\`\``, constraints:'1 ≤ s.length ≤ 15', hint_topic:'Map each symbol; subtract if current symbol < next symbol', companies:['Infosys','Wipro','TCS'], tags:['hashmap','string'] },

  // ── LINKED LISTS ──
  { slug:'reverse-linked-list', topic:'Linked Lists', title:'Reverse a Linked List', difficulty:'Easy', description:`Reverse a singly linked list.\n\n**Example:**\n\`\`\`\nInput:  1→2→3→4→5\nOutput: 5→4→3→2→1\n\`\`\``, constraints:'0 ≤ n ≤ 5000', hint_topic:'Three-pointer iteration: prev=null, curr=head, next. At each step: save next, point curr→prev, advance both', companies:['TCS','Infosys','Amazon'], tags:['linked-list','iteration'] },
  { slug:'detect-cycle', topic:'Linked Lists', title:'Detect Cycle in Linked List', difficulty:'Easy', description:`Determine if a linked list has a cycle.\n\n**Example:**\n\`\`\`\nInput: 3→2→0→-4→(back to 2)\nOutput: true\n\`\`\``, constraints:'Return true/false only', hint_topic:'Floyd\'s cycle detection: slow moves 1 step, fast moves 2 steps. If they meet, cycle exists', companies:['Microsoft','Adobe','Zoho'], tags:['two-pointers','linked-list'] },
  { slug:'merge-sorted-lists', topic:'Linked Lists', title:'Merge Two Sorted Lists', difficulty:'Easy', description:`Merge two sorted linked lists and return as one sorted list.\n\n**Example:**\n\`\`\`\nInput: l1=1→2→4, l2=1→3→4\nOutput: 1→1→2→3→4→4\n\`\`\``, constraints:'0 ≤ n,m ≤ 50', hint_topic:'Use dummy head node; compare heads and attach smaller; advance that pointer', companies:['TCS','Amazon','Wipro'], tags:['linked-list','recursion'] },
  { slug:'middle-of-list', topic:'Linked Lists', title:'Find Middle of Linked List', difficulty:'Easy', description:`Find the middle node of a linked list. If two middles, return second.\n\n**Example:**\n\`\`\`\nInput:  1→2→3→4→5\nOutput: node 3\n\`\`\``, constraints:'1 ≤ n ≤ 100', hint_topic:'Slow & Fast pointer: slow moves 1 step, fast moves 2 steps. When fast reaches end, slow is at middle', companies:['Infosys','Wipro'], tags:['two-pointers','linked-list'] },

  // ── TREES ──
  { slug:'inorder-traversal', topic:'Trees', title:'Binary Tree Inorder Traversal', difficulty:'Easy', description:`Return the inorder traversal (Left→Root→Right) of a binary tree.\n\n**Example:**\n\`\`\`\n    1\n     \\\n      2\n     /\n    3\nOutput: [1,3,2]\n\`\`\``, constraints:'0 ≤ n ≤ 100', hint_topic:'Recursive: inorder(left), visit root, inorder(right). Or use stack for iterative.', companies:['TCS','Microsoft','Amazon'], tags:['tree','recursion','dfs'] },
  { slug:'max-depth-tree', topic:'Trees', title:'Maximum Depth of Binary Tree', difficulty:'Easy', description:`Find maximum depth (number of nodes along longest root-to-leaf path).\n\n**Example:**\n\`\`\`\n    3\n   / \\\n  9  20\n    /  \\\n   15   7\nOutput: 3\n\`\`\``, constraints:'0 ≤ n ≤ 10⁴', hint_topic:'return 1 + max(maxDepth(left), maxDepth(right)). Base case: null → return 0', companies:['Amazon','Zoho','Infosys'], tags:['tree','recursion'] },
  { slug:'symmetric-tree', topic:'Trees', title:'Symmetric Tree (Mirror)', difficulty:'Easy', description:`Check if a binary tree is a mirror of itself (symmetric around center).\n\n**Example:**\n\`\`\`\n    1\n   / \\\n  2   2\n / \\ / \\\n3  4 4  3\nOutput: true\n\`\`\``, constraints:'1 ≤ n ≤ 1000', hint_topic:'Recursive isMirror(left, right): check left.val==right.val and recurse on outer and inner pairs', companies:['TCS','Infosys'], tags:['tree','recursion'] },
  { slug:'lowest-common-ancestor', topic:'Trees', title:'Lowest Common Ancestor (LCA)', difficulty:'Medium', description:`Find the LCA of two nodes p and q in a Binary Search Tree.\n\n**Example:**\n\`\`\`\nBST root=6, p=2, q=8\nOutput: 6  // LCA is root\n\`\`\``, constraints:'All node values are unique, p and q exist in tree', hint_topic:'BST property: if both p,q < root → go left. If both > root → go right. Else root is LCA.', companies:['Amazon','Microsoft','Adobe'], tags:['tree','bst','recursion'] },
  { slug:'level-order', topic:'Trees', title:'Level Order Traversal (BFS)', difficulty:'Medium', description:`Return level-order traversal as array of arrays.\n\n**Example:**\n\`\`\`\n    3\n   / \\\n  9  20\n    /  \\\n   15   7\nOutput: [[3],[9,20],[15,7]]\n\`\`\``, constraints:'0 ≤ n ≤ 2000', hint_topic:'Use queue. At each level, record queue size, process that many nodes, add their children.', companies:['Google','Amazon','Zoho'], tags:['tree','bfs','queue'] },

  // ── DYNAMIC PROGRAMMING ──
  { slug:'climbing-stairs', topic:'Dynamic Programming', title:'Climbing Stairs', difficulty:'Easy', description:`You can climb 1 or 2 steps. How many ways to reach step n?\n\n**Example:**\n\`\`\`\nInput: n=3\nOutput: 3  // {1,1,1}, {1,2}, {2,1}\n\`\`\``, constraints:'1 ≤ n ≤ 45', hint_topic:'Fibonacci pattern: dp[i] = dp[i-1] + dp[i-2]. Base: dp[1]=1, dp[2]=2', companies:['TCS','Infosys','Amazon'], tags:['dp','fibonacci'] },
  { slug:'coin-change', topic:'Dynamic Programming', title:'Coin Change (Minimum Coins)', difficulty:'Medium', description:`Find minimum number of coins to make amount. Return -1 if impossible.\n\n**Example:**\n\`\`\`\nInput: coins=[1,5,6,9], amount=11\nOutput: 2  // 5+6=11\n\`\`\``, constraints:'1 ≤ coins.length ≤ 12', hint_topic:'Bottom-up DP: dp[0]=0, dp[i] = min(dp[i-coin]+1) for each coin ≤ i', companies:['Amazon','Flipkart','Paytm'], tags:['dp','bfs'] },
  { slug:'longest-common-subsequence', topic:'Dynamic Programming', title:'Longest Common Subsequence (LCS)', difficulty:'Medium', description:`Return length of LCS of two strings.\n\n**Example:**\n\`\`\`\nInput: text1="abcde", text2="ace"\nOutput: 3  // "ace"\n\`\`\``, constraints:'1 ≤ text.length ≤ 1000', hint_topic:'2D DP table. dp[i][j] = dp[i-1][j-1]+1 if chars match, else max(dp[i-1][j], dp[i][j-1])', companies:['Google','Amazon','Zoho'], tags:['dp','string'] },
  { slug:'01-knapsack', topic:'Dynamic Programming', title:'0/1 Knapsack Problem', difficulty:'Medium', description:`Given weights and values of n items, find max value in knapsack of capacity W.\n\n**Example:**\n\`\`\`\nWeights: [2,3,4,5], Values: [3,4,5,6], W=5\nOutput: 7  // items 0+1 (weight=5, value=7)\n\`\`\``, constraints:'1 ≤ n ≤ 100, 1 ≤ W ≤ 1000', hint_topic:'2D DP: dp[i][w] = max(dp[i-1][w], val[i]+dp[i-1][w-wt[i]]) if wt[i]≤w', companies:['Amazon','Microsoft','Goldman Sachs'], tags:['dp','knapsack'] },
  { slug:'house-robber', topic:'Dynamic Programming', title:'House Robber', difficulty:'Easy', description:`Rob houses (can\'t rob adjacent). Find max money.\n\n**Example:**\n\`\`\`\nInput: [2,7,9,3,1]\nOutput: 12  // 2+9+1=12\n\`\`\``, constraints:'1 ≤ n ≤ 100', hint_topic:'dp[i] = max(dp[i-1], dp[i-2]+nums[i]). Only need two variables.', companies:['TCS','Wipro','Accenture'], tags:['dp','greedy'] },

  // ── GRAPHS ──
  { slug:'number-of-islands', topic:'Graphs', title:'Number of Islands', difficulty:'Medium', description:`Given a 2D grid of \'1\'s (land) and \'0\'s (water), count number of islands.\n\n**Example:**\n\`\`\`\n11110\n11010\n11000\n00000\nOutput: 1\n\`\`\``, constraints:'1 ≤ rows,cols ≤ 300', hint_topic:'DFS/BFS from each unvisited \'1\', mark connected cells as visited. Count DFS calls.', companies:['Amazon','Google','Microsoft'], tags:['dfs','bfs','graph'] },
  { slug:'bfs-shortest-path', topic:'Graphs', title:'Shortest Path in Binary Matrix', difficulty:'Medium', description:`Find shortest path from top-left to bottom-right (8 directions, cells must be 0).\n\n**Example:**\n\`\`\`\nInput: [[0,1],[1,0]]\nOutput: 2\n\`\`\``, constraints:'1 ≤ n ≤ 100', hint_topic:'BFS guarantees shortest path. Enqueue (row,col,dist), visit 8 neighbors.', companies:['Google','Amazon'], tags:['bfs','graph'] },
  { slug:'detect-cycle-directed', topic:'Graphs', title:'Detect Cycle in Directed Graph', difficulty:'Medium', description:`Given directed graph with n nodes and edges array, return true if cycle exists.\n\n**Example:**\n\`\`\`\nn=4, edges=[[0,1],[1,2],[2,0],[2,3]]\nOutput: true  // 0→1→2→0\n\`\`\``, constraints:'1 ≤ n ≤ 10⁵', hint_topic:'DFS with color marking: White(unvisited), Gray(in-stack), Black(done). Cycle if Gray neighbor found.', companies:['Microsoft','Adobe','Zoho'], tags:['dfs','graph','cycle'] },
  { slug:'topological-sort', topic:'Graphs', title:'Course Schedule (Topological Sort)', difficulty:'Medium', description:`Given numCourses and prerequisites pairs, can you finish all courses?\n\n**Example:**\n\`\`\`\nnumCourses=2, prerequisites=[[1,0]]\nOutput: true  // take 0 first, then 1\n\`\`\``, constraints:'1 ≤ numCourses ≤ 2000', hint_topic:'Topological sort (Kahn\'s algo): count in-degrees, BFS from nodes with in-degree 0', companies:['Amazon','Flipkart','Google'], tags:['topological-sort','bfs','graph'] },

  // ── SORTING & SEARCHING ──
  { slug:'binary-search', topic:'Searching', title:'Binary Search', difficulty:'Easy', description:`Search for target in sorted array. Return index or -1.\n\n**Example:**\n\`\`\`\nInput: nums=[-1,0,3,5,9,12], target=9\nOutput: 4\n\`\`\``, constraints:'1 ≤ nums.length ≤ 10⁴, unique values', hint_topic:'Set lo=0, hi=n-1. mid=(lo+hi)/2. If nums[mid]==target return mid. Adjust lo/hi.', companies:['TCS','Infosys','Wipro','Amazon'], tags:['binary-search','array'] },
  { slug:'search-rotated', topic:'Searching', title:'Search in Rotated Sorted Array', difficulty:'Medium', description:`Search target in rotated sorted array (no duplicates).\n\n**Example:**\n\`\`\`\nInput: nums=[4,5,6,7,0,1,2], target=0\nOutput: 4\n\`\`\``, constraints:'1 ≤ n ≤ 5000', hint_topic:'Modified binary search: determine which half is sorted, check if target lies in it', companies:['Google','Amazon','Microsoft'], tags:['binary-search','array'] },
  { slug:'merge-sort', topic:'Sorting', title:'Implement Merge Sort', difficulty:'Medium', description:`Implement Merge Sort to sort an integer array in ascending order.\n\n**Example:**\n\`\`\`\nInput: [38,27,43,3,9,82,10]\nOutput: [3,9,10,27,38,43,82]\n\`\`\``, constraints:'Explain time & space complexity', hint_topic:'Divide array in half, recursively sort each half, merge two sorted halves. O(n log n) time, O(n) space', companies:['TCS','Infosys','Wipro'], tags:['sorting','divide-and-conquer'] },
  { slug:'quick-sort', topic:'Sorting', title:'Implement Quick Sort', difficulty:'Medium', description:`Implement Quick Sort using last element as pivot.\n\n**Example:**\n\`\`\`\nInput: [10,7,8,9,1,5]\nOutput: [1,5,7,8,9,10]\n\`\`\``, constraints:'Handle duplicate elements correctly', hint_topic:'Partition: place pivot at correct position, elements ≤ pivot go left, > pivot go right. Recurse.', companies:['Amazon','Microsoft','Google'], tags:['sorting','recursion'] },

  // ── STACKS & QUEUES ──
  { slug:'implement-stack', topic:'Stacks & Queues', title:'Implement Stack using Queues', difficulty:'Easy', description:`Implement a stack using only two queues supporting push, pop, top, empty.\n\n**Example:**\n\`\`\`\npush(1), push(2), top()→2, pop()→2, empty()→false\n\`\`\``, constraints:'1 ≤ total operations ≤ 100', hint_topic:'Push: enqueue to q2, move all from q1 to q2, swap q1 and q2. Pop/Top: dequeue from q1.', companies:['Infosys','Wipro','TCS'], tags:['stack','queue','design'] },
  { slug:'next-greater-element', topic:'Stacks & Queues', title:'Next Greater Element', difficulty:'Medium', description:`For each element in nums1, find next greater in nums2. Return -1 if none.\n\n**Example:**\n\`\`\`\nInput: nums1=[4,1,2], nums2=[1,3,4,2]\nOutput: [-1,3,-1]\n\`\`\``, constraints:'All nums1 elements exist in nums2', hint_topic:'Monotonic stack on nums2. Pop when greater found, record (popped→current). Map lookups for nums1.', companies:['Amazon','Zoho','Flipkart'], tags:['stack','monotonic'] },

  // ── RECURSION & BACKTRACKING ──
  { slug:'subsets', topic:'Backtracking', title:'Generate All Subsets', difficulty:'Medium', description:`Return all possible subsets (power set) of an array of unique integers.\n\n**Example:**\n\`\`\`\nInput: [1,2,3]\nOutput: [[],[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]]\n\`\`\``, constraints:'1 ≤ n ≤ 10', hint_topic:'Backtracking: at each index, choose to include or exclude. Add current subset to result at each call.', companies:['Amazon','Microsoft','Google'], tags:['backtracking','recursion'] },
  { slug:'permutations', topic:'Backtracking', title:'All Permutations of Array', difficulty:'Medium', description:`Return all permutations of distinct integers.\n\n**Example:**\n\`\`\`\nInput: [1,2,3]\nOutput: [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]\n\`\`\``, constraints:'1 ≤ n ≤ 6', hint_topic:'Swap elements to generate permutations in-place, recurse with remaining positions', companies:['Google','Amazon','Zoho'], tags:['backtracking','recursion'] },
  { slug:'nqueens', topic:'Backtracking', title:'N-Queens Problem', difficulty:'Hard', description:`Place N queens on NxN board so no two queens attack each other. Return all solutions.\n\n**Example:**\n\`\`\`\nInput: N=4\nOutput: [[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]\n\`\`\``, constraints:'1 ≤ n ≤ 9', hint_topic:'Backtrack row by row. Use sets to track attacked columns, diagonals. If row==N, record solution.', companies:['Google','Amazon','Microsoft'], tags:['backtracking','recursion'] },

  // ── HASHING ──
  { slug:'group-anagrams', topic:'Hashing', title:'Group Anagrams', difficulty:'Medium', description:`Group strings that are anagrams of each other.\n\n**Example:**\n\`\`\`\nInput: ["eat","tea","tan","ate","nat","bat"]\nOutput: [["bat"],["nat","tan"],["ate","eat","tea"]]\n\`\`\``, constraints:'1 ≤ strs.length ≤ 10⁴', hint_topic:'Sort each string as key in hashmap. All anagrams map to same sorted key.', companies:['Amazon','Google','Zoho'], tags:['hashmap','string'] },
  { slug:'two-sum-hashmap', topic:'Hashing', title:'Subarray Sum Equals K', difficulty:'Medium', description:`Count number of subarrays that sum to k.\n\n**Example:**\n\`\`\`\nInput: nums=[1,1,1], k=2\nOutput: 2\n\`\`\``, constraints:'-10³ ≤ nums[i] ≤ 10³', hint_topic:'Prefix sum + hashmap: at each index, check if (prefixSum-k) exists in map', companies:['Amazon','Microsoft','Adobe'], tags:['hashmap','prefix-sum'] },

  // ── MATH ──
  { slug:'power-function', topic:'Math', title:'Implement pow(x, n)', difficulty:'Medium', description:`Implement pow(x, n) — x raised to n.\n\n**Example:**\n\`\`\`\npow(2.00000, 10) → 1024.00000\npow(2.10000, 3)  → 9.26100\npow(2.00000, -2) → 0.25000\n\`\`\``, constraints:'-100 ≤ x ≤ 100, -2³¹ ≤ n ≤ 2³¹-1', hint_topic:'Fast exponentiation: if n is even, pow(x,n)=pow(x*x,n/2). Handle negative n. O(log n) time.', companies:['TCS','Infosys','Amazon'], tags:['math','recursion','binary-search'] },
  { slug:'prime-sieve', topic:'Math', title:'Count Primes (Sieve of Eratosthenes)', difficulty:'Easy', description:`Count primes strictly less than n.\n\n**Example:**\n\`\`\`\nInput: 10\nOutput: 4  // primes: 2,3,5,7\n\`\`\``, constraints:'0 ≤ n ≤ 5×10⁶', hint_topic:'Sieve of Eratosthenes: mark composites from 2 to √n. Remaining unmarked = primes.', companies:['TCS','Infosys','Wipro'], tags:['math','sieve'] },

  // ── APTITUDE (for placement exams) ──
  { slug:'train-crossing', topic:'Aptitude', title:'Train Crossing Problem', difficulty:'Easy', description:`A train 150m long passes a pole in 15 seconds. How long to pass a platform 100m long?\n\n**Step-by-step:**\n- Speed = Distance/Time = 150/15 = 10 m/s\n- Distance to cross platform = 150+100 = 250m\n- Time = 250/10 = **25 seconds**\n\n**Formula:** Time = (Train length + Platform length) / Speed`, constraints:'Choose correct MCQ answer', hint_topic:'Speed = Train_length / time_to_cross_pole. Total distance = train + platform lengths.', companies:['TCS','Wipro','Infosys','Accenture'], tags:['aptitude','speed-distance'] },
  { slug:'work-time', topic:'Aptitude', title:'Work and Time Problem', difficulty:'Easy', description:`A can do a job in 12 days, B in 16 days. How long together?\n\n**Step-by-step:**\n- A\'s rate = 1/12 per day\n- B\'s rate = 1/16 per day\n- Combined = 1/12 + 1/16 = 7/48 per day\n- Time = **48/7 ≈ 6.86 days**\n\n**Formula:** 1/T = 1/A + 1/B`, constraints:'Choose correct MCQ answer', hint_topic:'Work rate = 1/days. Add rates for combined work.', companies:['TCS','Infosys','Wipro'], tags:['aptitude','work-time'] },
  { slug:'profit-loss', topic:'Aptitude', title:'Profit and Loss', difficulty:'Easy', description:`A shopkeeper buys at ₹800, sells at ₹1000. What is the profit percentage?\n\n**Step-by-step:**\n- Profit = 1000 - 800 = ₹200\n- Profit% = (Profit/Cost) × 100 = (200/800) × 100 = **25%**\n\n**Formula:** Profit% = ((SP-CP)/CP) × 100`, constraints:'Choose correct MCQ answer', hint_topic:'Always use CP (cost price) as base for percentage calculation', companies:['TCS','Wipro','Infosys','Cognizant'], tags:['aptitude','profit-loss'] },
  { slug:'permutation-combination', topic:'Aptitude', title:'Permutation and Combination', difficulty:'Medium', description:`In how many ways can 5 people be seated in 3 chairs?\n\n**Step-by-step:**\n- Order matters → Permutation\n- P(5,3) = 5!/(5-3)! = 5×4×3 = **60 ways**\n\n**Formula:** P(n,r) = n!/(n-r)! for permutation. C(n,r) = n!/(r!(n-r)!) for combination.`, constraints:'Apply correct formula for each variant', hint_topic:'If order matters → Permutation. If order doesn\'t matter → Combination.', companies:['TCS','Infosys','Capgemini'], tags:['aptitude','permutation'] },
];

/* ──────────────────────────────────────────────
   ROUTES
────────────────────────────────────────────── */

// GET /api/coding/problems
router.get('/problems', authMiddleware, async (req, res) => {
  try {
    const { topic, difficulty, search } = req.query;

    let query = supabaseAdmin
      .from('coding_problems')
      .select('id,slug,title,topic,difficulty,companies,tags,created_at')
      .order('topic').order('difficulty');

    if (topic && topic !== 'All') query = query.eq('topic', topic);
    if (difficulty && difficulty !== 'All') query = query.eq('difficulty', difficulty);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data: problems, error: err } = await query;
    if (err) throw err;

    // Attach user's attempt status
    const { data: attempts } = await supabaseAdmin
      .from('coding_attempts')
      .select('problem_id, status')
      .eq('user_id', req.user.id);

    const attemptMap = {};
    (attempts || []).forEach(a => { attemptMap[a.problem_id] = a.status; });

    const enriched = (problems || []).map(p => ({
      ...p,
      user_status: attemptMap[p.id] || 'unsolved',
    }));

    return res.json(success({ problems: enriched, total: enriched.length }));
  } catch (err) {
    console.error('[coding/problems]', err);
    return res.status(500).json(error('Failed to fetch problems'));
  }
});

// GET /api/coding/problems/:slug
router.get('/problems/:slug', authMiddleware, async (req, res) => {
  try {
    const { data: problem, error: err } = await supabaseAdmin
      .from('coding_problems')
      .select('*')
      .eq('slug', req.params.slug)
      .single();

    if (err || !problem) return res.status(404).json(error('Problem not found'));

    // Get user's previous attempts for this problem
    const { data: attempts } = await supabaseAdmin
      .from('coding_attempts')
      .select('status, code, language, created_at')
      .eq('user_id', req.user.id)
      .eq('problem_id', problem.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return res.json(success({ problem, attempts: attempts || [] }));
  } catch (err) {
    console.error('[coding/problem]', err);
    return res.status(500).json(error('Failed to fetch problem'));
  }
});

// POST /api/coding/problems/:slug/hint — AI hint
router.post('/problems/:slug/hint', authMiddleware, async (req, res) => {
  try {
    const { data: problem } = await supabaseAdmin
      .from('coding_problems')
      .select('title,description,hint_topic,topic,difficulty')
      .eq('slug', req.params.slug)
      .single();

    if (!problem) return res.status(404).json(error('Problem not found'));

    const { userCode = '', hintLevel = 1 } = req.body;

    const model = process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:1.5b';
    const prompt = `You are a DSA tutor helping an Indian engineering student.

Problem: ${problem.title} (${problem.topic}, ${problem.difficulty})
Hint topic: ${problem.hint_topic}

${userCode ? `Student's current code:\n${userCode.substring(0, 500)}` : 'Student hasn\'t written code yet.'}

Give a Level ${hintLevel} hint (1=gentle nudge, 2=approach outline, 3=step-by-step guide).
Keep it concise, educational. Don't give full solution for level 1 or 2.

Return JSON: {"hint": "your hint text", "complexity": "Time: O(?), Space: O(?)", "next_step": "what to try next"}`;

    const raw = await generateCompletion(model, prompt, { temperature: 0.3, max_tokens: 400, timeoutMs: 45_000 });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { hint: problem.hint_topic, complexity: '', next_step: 'Try breaking the problem into smaller parts.' };

    return res.json(success(parsed));
  } catch (err) {
    console.error('[coding/hint]', err);
    return res.status(500).json(error('Failed to generate hint'));
  }
});

// POST /api/coding/attempt — save attempt
router.post('/attempt', authMiddleware, async (req, res) => {
  try {
    const { problem_slug, status, code, language = 'python' } = req.body;
    if (!problem_slug || !status) return res.status(400).json(error('problem_slug and status required'));

    const { data: problem } = await supabaseAdmin
      .from('coding_problems')
      .select('id')
      .eq('slug', problem_slug)
      .single();

    if (!problem) return res.status(404).json(error('Problem not found'));

    await supabaseAdmin.from('coding_attempts').upsert({
      user_id: req.user.id,
      problem_id: problem.id,
      status, // 'solved' | 'attempted' | 'bookmarked'
      code: code?.substring(0, 5000) || '',
      language,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,problem_id' });

    // Update streak (async)
    updateStreak(req.user.id).catch(() => {});

    return res.json(success({ message: 'Attempt saved' }));
  } catch (err) {
    console.error('[coding/attempt]', err);
    return res.status(500).json(error('Failed to save attempt'));
  }
});

// GET /api/coding/progress — topic-wise progress
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const { data: attempts } = await supabaseAdmin
      .from('coding_attempts')
      .select('problem_id, status, coding_problems(topic, difficulty)')
      .eq('user_id', req.user.id);

    const { data: allProblems } = await supabaseAdmin
      .from('coding_problems')
      .select('id, topic, difficulty');

    const topicMap = {};
    (allProblems || []).forEach(p => {
      if (!topicMap[p.topic]) topicMap[p.topic] = { total: 0, solved: 0, easy: 0, medium: 0, hard: 0 };
      topicMap[p.topic].total++;
      topicMap[p.topic][p.difficulty.toLowerCase()]++;
    });

    (attempts || []).forEach(a => {
      if (a.status === 'solved' && a.coding_problems?.topic) {
        const t = a.coding_problems.topic;
        if (topicMap[t]) topicMap[t].solved++;
      }
    });

    const progress = Object.entries(topicMap).map(([topic, stats]) => ({
      topic,
      ...stats,
      pct: stats.total ? Math.round((stats.solved / stats.total) * 100) : 0,
    }));

    return res.json(success({ progress, total_solved: (attempts || []).filter(a => a.status === 'solved').length }));
  } catch (err) {
    console.error('[coding/progress]', err);
    return res.status(500).json(error('Failed to fetch progress'));
  }
});

// GET /api/coding/seed — admin only, seeds problems DB
router.post('/seed', authMiddleware, async (req, res) => {
  const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL;
  if (req.user.role !== 'admin' && !(SUPER_ADMIN && req.user.email === SUPER_ADMIN)) {
    return res.status(403).json(error('Admin only'));
  }
  try {
    const { error: err } = await supabaseAdmin
      .from('coding_problems')
      .upsert(SEED_PROBLEMS.map(p => ({
        slug: p.slug,
        title: p.title,
        topic: p.topic,
        difficulty: p.difficulty,
        description: p.description,
        constraints: p.constraints,
        hint_topic: p.hint_topic,
        companies: p.companies,
        tags: p.tags,
      })), { onConflict: 'slug' });

    if (err) throw err;
    return res.json(success({ message: `${SEED_PROBLEMS.length} problems seeded successfully` }));
  } catch (err) {
    console.error('[coding/seed]', err);
    return res.status(500).json(error('Seeding failed: ' + err.message));
  }
});

async function updateStreak(userId) {
  const today = new Date().toISOString().split('T')[0];
  await supabaseAdmin.from('user_streaks').upsert({
    user_id: userId,
    last_active_date: today,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

module.exports = router;
