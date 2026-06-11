/**
 * backend/routes/pyq.js
 * Previous Year Questions (PYQ) Bank
 * Subjects: DS, OS, DBMS, CN, Software Engg, Maths, C/Java/Python
 * Universities: JNTU, VTU, Anna University
 */
const express = require('express');
const router  = express.Router();
const authMiddleware  = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');



// ── Built-in PYQ seed data ─────────────────────────────────────────
const PYQ_SEED = [
  // DATA STRUCTURES
  { subject: 'Data Structures', university: 'JNTU', year: 2023, semester: 'Nov', unit: 1,
    question: 'Explain the concept of Abstract Data Types (ADT) with examples.',
    marks: 10, type: 'long', difficulty: 'Medium',
    answer_hint: 'ADT defines data type by operations; examples: Stack (push/pop), Queue (enqueue/dequeue)',
  },
  { subject: 'Data Structures', university: 'JNTU', year: 2023, semester: 'Nov', unit: 2,
    question: 'Write an algorithm for insertion in a doubly linked list. Trace it with an example.',
    marks: 10, type: 'long', difficulty: 'Medium',
    answer_hint: 'Maintain prev and next pointers; update both sides on insertion',
  },
  { subject: 'Data Structures', university: 'VTU', year: 2022, semester: 'Dec', unit: 3,
    question: 'Define binary search tree. Write algorithms for insertion, deletion, and search. Show the trace for inserting 50, 30, 70, 20, 40.',
    marks: 14, type: 'long', difficulty: 'Hard',
    answer_hint: 'BST property: left < root < right; deletion has 3 cases (leaf, one child, two children)',
  },
  { subject: 'Data Structures', university: 'Anna University', year: 2023, semester: 'May', unit: 4,
    question: 'Explain Dijkstra\'s shortest path algorithm with an example.',
    marks: 13, type: 'long', difficulty: 'Hard',
    answer_hint: 'Greedy; picks minimum distance vertex each step; uses visited set and distance array',
  },
  { subject: 'Data Structures', university: 'JNTU', year: 2022, semester: 'May', unit: 5,
    question: 'What is hashing? Explain open addressing and chaining collision resolution techniques.',
    marks: 10, type: 'long', difficulty: 'Medium',
    answer_hint: 'Hash function maps key to index; open addressing probes next slot; chaining uses linked list at index',
  },
  { subject: 'Data Structures', university: 'VTU', year: 2021, semester: 'Dec', unit: 2,
    question: 'Write a C program to implement stack using arrays. Show push and pop operations.',
    marks: 10, type: 'program', difficulty: 'Easy',
    answer_hint: 'Use int stack[MAX]; int top=-1; push: stack[++top]=x; pop: return stack[top--]',
  },
  { subject: 'Data Structures', university: 'Anna University', year: 2022, semester: 'Nov', unit: 3,
    question: 'Differentiate BFS and DFS. Write BFS algorithm and trace it on a sample graph.',
    marks: 13, type: 'long', difficulty: 'Medium',
    answer_hint: 'BFS uses queue, visits level by level; DFS uses stack/recursion, goes deep first',
  },

  // OPERATING SYSTEMS
  { subject: 'Operating Systems', university: 'JNTU', year: 2023, semester: 'Nov', unit: 1,
    question: 'Explain the different states of a process with a state diagram.',
    marks: 10, type: 'long', difficulty: 'Medium',
    answer_hint: 'New→Ready→Running→Blocked→Terminated; preemption moves Running back to Ready',
  },
  { subject: 'Operating Systems', university: 'VTU', year: 2023, semester: 'Jun', unit: 2,
    question: 'Explain the Round Robin CPU scheduling algorithm with an example (quantum = 3). Calculate average waiting time.',
    marks: 14, type: 'long', difficulty: 'Medium',
    answer_hint: 'Each process gets quantum time slice; circular; calculate waiting time = (start - arrival) accumulated',
  },
  { subject: 'Operating Systems', university: 'JNTU', year: 2022, semester: 'May', unit: 3,
    question: 'What is deadlock? State the necessary conditions for deadlock. Explain the Banker\'s algorithm.',
    marks: 14, type: 'long', difficulty: 'Hard',
    answer_hint: 'Coffman conditions: Mutual exclusion, Hold & wait, No preemption, Circular wait; Banker\'s: check safe state',
  },
  { subject: 'Operating Systems', university: 'Anna University', year: 2023, semester: 'May', unit: 4,
    question: 'Explain paging in memory management. How does address translation work?',
    marks: 13, type: 'long', difficulty: 'Medium',
    answer_hint: 'Logical address = page number + offset; physical address from page table; TLB speeds up translation',
  },
  { subject: 'Operating Systems', university: 'VTU', year: 2022, semester: 'Dec', unit: 5,
    question: 'Compare FCFS and Shortest Job First disk scheduling algorithms.',
    marks: 10, type: 'short', difficulty: 'Easy',
    answer_hint: 'FCFS: simple, may cause starvation; SJF: reduces average waiting, needs burst time estimate',
  },

  // DBMS
  { subject: 'DBMS', university: 'JNTU', year: 2023, semester: 'Nov', unit: 1,
    question: 'What is normalization? Explain 1NF, 2NF, and 3NF with examples.',
    marks: 14, type: 'long', difficulty: 'Hard',
    answer_hint: '1NF: atomic values; 2NF: no partial dependency; 3NF: no transitive dependency',
  },
  { subject: 'DBMS', university: 'Anna University', year: 2023, semester: 'Nov', unit: 2,
    question: 'Write SQL queries for the following: (i) Find employees earning more than average salary (ii) List department-wise count of employees (iii) Find second highest salary.',
    marks: 13, type: 'program', difficulty: 'Medium',
    answer_hint: 'Use subquery for avg; GROUP BY dept for count; ORDER BY DESC LIMIT 1 OFFSET 1 for 2nd highest',
  },
  { subject: 'DBMS', university: 'VTU', year: 2022, semester: 'Dec', unit: 3,
    question: 'Explain the ACID properties of transactions with suitable examples.',
    marks: 10, type: 'long', difficulty: 'Medium',
    answer_hint: 'Atomicity: all or nothing; Consistency: valid state; Isolation: concurrent txns appear serial; Durability: committed data persists',
  },
  { subject: 'DBMS', university: 'JNTU', year: 2022, semester: 'May', unit: 4,
    question: 'Explain ER diagram with all notations. Draw an ER diagram for a Library Management System.',
    marks: 14, type: 'diagram', difficulty: 'Medium',
    answer_hint: 'Entities: Book, Member, Librarian; Relationships: borrow (M:N), manage; Attributes for each',
  },
  { subject: 'DBMS', university: 'Anna University', year: 2022, semester: 'May', unit: 5,
    question: 'What is a view? Explain the advantages of views in DBMS with examples.',
    marks: 10, type: 'short', difficulty: 'Easy',
    answer_hint: 'Virtual table; advantages: security (hide columns), simplify complex queries, logical independence',
  },

  // COMPUTER NETWORKS
  { subject: 'Computer Networks', university: 'JNTU', year: 2023, semester: 'Nov', unit: 1,
    question: 'Explain the OSI reference model with the function of each layer.',
    marks: 14, type: 'long', difficulty: 'Medium',
    answer_hint: '7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application; each has specific role',
  },
  { subject: 'Computer Networks', university: 'VTU', year: 2023, semester: 'Jun', unit: 3,
    question: 'What is TCP/IP protocol? Compare TCP and UDP.',
    marks: 10, type: 'short', difficulty: 'Easy',
    answer_hint: 'TCP: connection-oriented, reliable, ordered; UDP: connectionless, faster, no guarantee',
  },
  { subject: 'Computer Networks', university: 'Anna University', year: 2023, semester: 'May', unit: 4,
    question: 'Explain the working of DNS. What is the DNS resolution process?',
    marks: 13, type: 'long', difficulty: 'Medium',
    answer_hint: 'Hierarchical system: root→TLD→authoritative; recursive vs iterative resolution; caching',
  },
  { subject: 'Computer Networks', university: 'JNTU', year: 2022, semester: 'May', unit: 5,
    question: 'Explain CSMA/CD protocol. How does collision detection work in Ethernet?',
    marks: 10, type: 'long', difficulty: 'Medium',
    answer_hint: 'Listen before transmit; detect collision; jam signal; exponential backoff; half-duplex Ethernet',
  },

  // SOFTWARE ENGINEERING
  { subject: 'Software Engineering', university: 'JNTU', year: 2023, semester: 'Nov', unit: 1,
    question: 'Compare Waterfall and Agile software development models.',
    marks: 10, type: 'short', difficulty: 'Easy',
    answer_hint: 'Waterfall: sequential, rigid; Agile: iterative, flexible, customer collaboration; both have pros/cons',
  },
  { subject: 'Software Engineering', university: 'VTU', year: 2022, semester: 'Dec', unit: 3,
    question: 'What is software testing? Explain white box and black box testing.',
    marks: 10, type: 'long', difficulty: 'Medium',
    answer_hint: 'White box: internal code structure known; Black box: only I/O; both are complementary',
  },
  { subject: 'Software Engineering', university: 'Anna University', year: 2023, semester: 'Nov', unit: 2,
    question: 'Explain UML class diagrams and use case diagrams with examples from a banking system.',
    marks: 13, type: 'diagram', difficulty: 'Medium',
    answer_hint: 'Class: attributes + methods + relationships; Use case: actors + interactions; bank has Customer, Account, Transaction',
  },

  // ENGINEERING MATHEMATICS
  { subject: 'Engineering Mathematics', university: 'JNTU', year: 2023, semester: 'Nov', unit: 1,
    question: 'Find the eigenvalues and eigenvectors of the matrix A = [[2,1],[1,2]].',
    marks: 10, type: 'problem', difficulty: 'Medium',
    answer_hint: 'det(A-λI)=0; λ=1,3; for λ=1: v=[1,-1]; for λ=3: v=[1,1]',
  },
  { subject: 'Engineering Mathematics', university: 'VTU', year: 2023, semester: 'Jun', unit: 4,
    question: 'Solve the differential equation dy/dx + 2y = 4x.',
    marks: 7, type: 'problem', difficulty: 'Medium',
    answer_hint: 'Linear ODE; integrating factor e^(2x); y = 2x - 1 + Ce^(-2x)',
  },
  { subject: 'Engineering Mathematics', university: 'Anna University', year: 2022, semester: 'Nov', unit: 2,
    question: 'Find the Laplace transform of f(t) = t²e^(at).',
    marks: 7, type: 'problem', difficulty: 'Medium',
    answer_hint: 'L{t^n e^(at)} = n!/(s-a)^(n+1); here L{t²e^(at)} = 2/(s-a)³',
  },
];

// ── GET /api/pyq/questions ────────────────────────────────────────
// Query: subject, university, year, type, difficulty, search, page, limit
router.get('/questions', authMiddleware, async (req, res) => {
  const {
    subject, university, year, type, difficulty, search,
    page = 1, limit = 20,
  } = req.query;

  let filtered = [...PYQ_SEED];

  if (subject)     filtered = filtered.filter(q => q.subject === subject);
  if (university)  filtered = filtered.filter(q => q.university === university);
  if (year)        filtered = filtered.filter(q => q.year === parseInt(year));
  if (type)        filtered = filtered.filter(q => q.type === type);
  if (difficulty)  filtered = filtered.filter(q => q.difficulty === difficulty);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(q =>
      q.question.toLowerCase().includes(s) ||
      q.subject.toLowerCase().includes(s)
    );
  }

  const total  = filtered.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const items  = filtered.slice(offset, offset + parseInt(limit)).map((q, i) => ({
    id: `pyq_${offset + i}`,
    ...q,
  }));

  return success(res, {
    questions: items,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
  });
});

// ── GET /api/pyq/subjects ─────────────────────────────────────────
router.get('/subjects', authMiddleware, (req, res) => {
  const subjects     = [...new Set(PYQ_SEED.map(q => q.subject))].sort();
  const universities = [...new Set(PYQ_SEED.map(q => q.university))].sort();
  const years        = [...new Set(PYQ_SEED.map(q => q.year))].sort((a, b) => b - a);

  return success(res, { subjects, universities, years });
});

// ── POST /api/pyq/explain ─────────────────────────────────────────
// Body: { question, subject, answer_hint }
// Returns AI-detailed explanation
router.post('/explain', authMiddleware, async (req, res) => {
  const { question, subject, answer_hint, marks } = req.body;
  if (!question) return error(res, 'question is required');

  const prompt = `You are an expert professor for Indian engineering students (JNTU/VTU/Anna University).

Subject: ${subject || 'Engineering'}
Question (${marks || 10} marks): ${question}
Key points to cover: ${answer_hint || 'Standard textbook answer'}

Write a complete, exam-ready answer that:
1. Directly answers the question
2. Uses proper technical terminology
3. Includes diagrams described in text where needed (e.g., "[Draw BST diagram here]")
4. Is structured for the marks awarded (${marks || 10} marks = ~${(marks || 10) * 30} words)
5. Follows Indian engineering university exam format

Write the answer in clear sections. Do not write JSON. Write the answer as if you are a student writing in an exam.`;

  try {
    const explanation = await aiChat(prompt);
    return success(res, { explanation: explanation.trim() });
  } catch (err) {
    console.error('[pyq/explain]', err.message);
    return error(res, 'AI explanation failed. Please check if Ollama is running.', 500);
  }
});

// ── POST /api/pyq/bookmark ────────────────────────────────────────
router.post('/bookmark', authMiddleware, async (req, res) => {
  const { question_hash, subject, question, university, year } = req.body;
  if (!question_hash) return error(res, 'question_hash required');

  const { data, error: dbErr } = await supabaseAdmin
    .from('pyq_bookmarks')
    .upsert({
      student_id: req.user.id,
      question_hash,
      subject, question, university, year,
    }, { onConflict: 'student_id,question_hash' })
    .select().single();

  if (dbErr) return error(res, dbErr.message);
  return success(res, { bookmark: data });
});

// ── GET /api/pyq/bookmarks ────────────────────────────────────────
router.get('/bookmarks', authMiddleware, async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('pyq_bookmarks')
    .select('*')
    .eq('student_id', req.user.id)
    .order('created_at', { ascending: false });

  if (dbErr) return error(res, dbErr.message);
  return success(res, { bookmarks: data || [] });
});

// ── DELETE /api/pyq/bookmark/:hash ───────────────────────────────
router.delete('/bookmark/:hash', authMiddleware, async (req, res) => {
  await supabaseAdmin
    .from('pyq_bookmarks')
    .delete()
    .eq('student_id', req.user.id)
    .eq('question_hash', req.params.hash);

  return success(res, { message: 'Bookmark removed' });
});

module.exports = router;
