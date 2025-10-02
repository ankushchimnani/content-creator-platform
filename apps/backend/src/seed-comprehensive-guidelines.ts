import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding comprehensive guidelines templates...');

  // Find the super admin user
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });

  if (!superAdmin) {
    console.error('Super admin user not found. Please run seed-super-admin.ts first.');
    return;
  }

  // Assignment Guidelines
  const assignmentGuidelines = `# Guide to Create High-Quality Assignments

## Our Philosophy: Why We Give Assignments

Think of each assignment as a comprehensive health check for our learners. Right after a lecture, we want to see: "Did they get it?" "Can they apply it?" and "Can they build with it?" Each assignment is designed to test the full spectrum of understanding, from simple recall to complex problem-solving. Your goal is to create a clear, engaging, and purposeful learning tool.

## The Anatomy of a High-Quality Assignment

### Difficulty Distribution and Progression

Assignments must follow a specific structure to guide learners from foundational knowledge to advanced application. The assignment structure is broken into three levels: **Easy, Moderate, and Hard.** Although the number of questions varies by level, they are weighted conceptually to represent a **30% (Easy), 50% (Moderate), and 20% (Hard)** distribution of effort and complexity.

| **Level**    | **Number of Qs**  | **What It Should Test**                                                                                                                                                                                               |
| :----------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Easy**     | 10 - 15 Questions | **Knowledge-based:** Direct recall of facts, definitions, and formulas. These should be Multiple Choice (MCQ), Multiple Select (MSQ), or Numerical Answer Type (NAT) questions.                                       |
| **Moderate** | 3 - 5 Questions   | **Implementation-based:** Applying known concepts or formulas from the session to guided, subjective problems.                                                                                                        |
| **Hard**     | 1 - 2 Questions   | **Application & Synthesis:** A practical, subjective task combining concepts from the current session and earlier topics or related topics. It may require learners to explore slightly beyond the taught curriculum. |

**Key Rules:**
- **Required Structure:** Every assignment must contain the specified number of questions for all three levels.
- **Progressive Difficulty:** Questions **must** be ordered from easy to hard. The assignment should begin with the block of Easy questions, followed by Moderate, and concluding with Hard.

### Content and Relevance
- **Topic Relevance:** Easy and Moderate questions must strictly relate to the specified Topic and stay within the scope of the Topics covered so far. Hard questions may require some exploration beyond the explicitly taught curriculum to encourage problem-solving.
- **Factual Correctness:** All information, scenarios, and data presented must be factually accurate and logically sound. Avoid impossible scenarios (e.g., "apply binary search on an unsorted array").

### Clarity and Quality of Writing
- **Clarity and Specificity:** Questions must be completely unambiguous.
  - Clearly state all constraints.
  - Specify data types (e.g., "integer array" instead of just "list of numbers").
  - Provide sample inputs and expected outputs for coding problems.
  - There should be no room for multiple interpretations.
- **Creativity and Engagement:** Make the problems interesting!
  - Use real-world applications and relatable word problems, especially for Moderate and Hard questions.
  - Frame questions in a way that hooks the learner's interest (e.g., instead of "Implement binary search," use "You're searching for an item in a sorted inventory of 100,000 products...").
- **Grammar and Spelling:** All text must be free of spelling and grammatical errors. Use professional language and proper punctuation.

## Writing Great Questions
- **Be detailed and self-contained.** A learner should have all the information they need within the question itself.
- **Show, don't just tell.** Always provide examples of expected input and output for programming tasks.
- **Use a variety of verbs.** Mix "define" and "list" (Easy) with "calculate" and "implement" (Moderate), and "analyze," "design," and "optimize" (Hard) to signal the expected depth of thinking.
- **Avoid ambiguity at all costs.** Reread your question and ask, "Could this be interpreted in any other way?" If yes, rewrite it.
- **Context is king.** A little bit of storytelling or a real-world scenario can make a dry problem much more engaging.

## Quality-Control Checklist
1. **Grammar & Spelling:** Is the entire assignment free of typos and grammatical errors?
2. **Topic Relevance:** Do all questions relate to the session's topic? Is the scope appropriate for each difficulty level?
3. **Difficulty Distribution:** Does the assignment contain 10-15 Easy (MCQ/MSQ/NAT), 3-5 Moderate, and 1-2 Hard questions?
4. **Progressive Difficulty:** Are the questions ordered correctly (Easy → Moderate → Hard)?
5. **Creativity & Engagement:** Are the problems (especially Moderate/Hard) interesting and context-rich?
6. **Clarity & Specificity:** Is every question crystal clear? Are all constraints, data types, and examples included?
7. **Factual Correctness:** Is all information in the assignment factually and logically sound?
8. **Completeness:** Is an answer key or evaluation rubric attached?

Design assignments that feel like a conversation: "You learned X—now can you show me how you can use it?" Keep them clear, detailed, and purposeful.`;

  // Lecture Notes Guidelines
  const lectureNotesGuidelines = `# Complete Guide to Writing Pedagogical Lecture Notes

These are **comprehensive, practical rules** for anyone writing notes for learners. This document focuses on **how to write** so that your notes are consistently clear, useful, pedagogically sound, and optimized for beginner comprehension.

## Non-negotiables
- **Markdown only:** Write everything in .md.
- **Host images:** Upload images to a public platform and use the accessible link. The image must be visible in a standard markdown viewer.
- **Audience:** Assume you are writing for **beginners** unless specified otherwise.
- **Prerequisites:** Always state the required prior knowledge in a single, short line near the top of the note.
- **Beginner validation:** Before finalizing, ask yourself: "Could I have understood this before I learned the topic?"

## Before You Write (5-8 Minutes)
1. **Goal:** Define 2–3 specific learner outcomes. Use action verbs like _identify, apply, compare, explain, or build_.
2. **Scope:** Stick to one core topic per note. Defer related but non-essential information to separate notes to maintain focus.
3. **Examples:** Decide on the single best worked example or mini-case study that will make the concept concrete for the learner.
4. **Prerequisite check:** List exactly what the learner needs to know beforehand. Be specific enough for self-assessment.
5. **Mental model:** Identify what accurate internal representation you want the learner to build by the end.
6. **Common confusions:** Anticipate 2-3 misconceptions beginners typically have about this topic.

## While You Write (Core Principles)

### Pedagogical Foundation
1. **Build progressively:** Start with the simplest case, then add complexity incrementally. Never introduce multiple new concepts simultaneously.
2. **Concrete before abstract:** Always provide tangible examples before introducing general principles or theory.
3. **Manage cognitive load:** Break complex information into digestible chunks. Each section should focus on one sub-concept.
4. **Scaffold understanding:** Each new idea should build logically on what came before. Make dependencies explicit.
5. **Address the "why":** Never present a procedure or fact without explaining its purpose or rationale.

### Content Quality
6. **Use plain words:** Avoid jargon. If a technical term is necessary, define it immediately and briefly in parentheses or a callout.
7. **Be precise with definitions:** Core concepts deserve 2-3 sentences for accurate, nuanced definitions—not just one-liners.
8. **Show multiple facets:** Use 2-3 diverse examples that reveal different aspects of the concept, not just variations of the same scenario.
9. **Include counter-examples:** Show what the concept is NOT to prevent common confusions.
10. **State limitations:** When using analogies, explicitly mention where they break down.

### Structure & Format
11. **Bullets > paragraphs:** Use lists for attributes and small tables for comparisons to make information easy to digest.
12. **Show, don't tell:** Always include at least **one worked example** (a code snippet or a mini-case study) with detailed commentary.
13. **Use strategic headings:** Add headings every 2–6 paragraphs to break up text and improve scannability.
14. **Progressive revelation:** In diagrams and explanations, reveal complexity step-by-step, not all at once.

### Active Learning
15. **Add a practice task:** Include a small, authentic exercise that learners can complete in 15-20 minutes.
16. **Frequent check-ins:** Insert "Check your understanding" questions every major section, not just at the end.
17. **Provide worked solutions:** For practice problems, show step-by-step solutions with reasoning, not just answers.
18. **Enable self-assessment:** Give learners clear criteria to judge if they've mastered the material.

### Error Prevention
19. **Anticipate pitfalls:** Dedicate space to common mistakes beginners make and why they happen.
20. **Explain wrong answers:** When showing errors, explain the faulty reasoning that leads to them.
21. **Offer recovery paths:** If learners are stuck, point them to which earlier section to revisit.
22. **Use callouts strategically:** Emphasize key information with callouts like **Tip** (a shortcut), **Note** (a nuance), **Caution** (a common error), or **Remember** (a prerequisite connection).

### Motivation & Engagement
23. **Establish relevance early:** Answer "why does this matter?" in the introduction with concrete benefits.
24. **Use relatable analogies:** Connect to domains familiar to your target audience (everyday life, not specialized knowledge).
25. **Show real-world applications:** Provide genuine use cases, not contrived textbook examples.
26. **Acknowledge difficulty:** When something is genuinely hard, say so—it validates learner struggles.

### Consistency & Quality
27. **Follow templates:** Use the provided structure unless a lead instructs you otherwise.
28. **Cut the fluff:** On your second pass, aim to remove approximately 20% of your words while keeping all essential content.
29. **Be consistent:** Use the same terminology, notation, and formatting conventions throughout.
30. **Active voice:** "Run the test" is better than "The test should be run."

## Quality Assurance Checklist

### Conceptual Clarity
- [ ] Prerequisites are specific and listed at the top
- [ ] Core concept is defined accurately (2-3 sentences, not oversimplified)
- [ ] Scope is clearly bounded (what's included vs. excluded)
- [ ] Mental model is explicitly built, not just implied

### Progressive Learning
- [ ] Concepts are sequenced from simple to complex
- [ ] Each new idea builds on prior ones with explicit connections
- [ ] No more than one major new concept per section
- [ ] Cognitive load is managed (information chunked appropriately)

### Examples & Practice
- [ ] At least 2-3 diverse examples showing different facets
- [ ] One fully worked example with detailed step-by-step explanation
- [ ] Counter-examples or "what it's NOT" included
- [ ] Practice task is authentic and completable in 15-20 minutes

### Error Prevention
- [ ] Common misconceptions are addressed explicitly
- [ ] Pitfalls table shows WHY errors happen and WHY solutions work
- [ ] Recovery paths are provided ("If confused, revisit section X")
- [ ] Limitations of analogies or examples are stated

### Engagement & Motivation
- [ ] "Why this matters" is answered with concrete benefits
- [ ] Real-world applications are shown (not just toy examples)
- [ ] Analogies connect to beginner-accessible domains
- [ ] Language is encouraging and acknowledges difficulty where appropriate

### Structure & Format
- [ ] Headings break up text every 2-6 paragraphs
- [ ] Bullets and tables are used where they improve clarity
- [ ] Active voice is used throughout
- [ ] Technical terms are defined on first use
- [ ] Callouts (Tip/Note/Caution) highlight key information

### Self-Assessment Support
- [ ] "Check your understanding" questions appear throughout
- [ ] Questions require explanation, not just recall
- [ ] Answers explain the "why," not just the "what"
- [ ] Clear success criteria: learner knows if they've mastered it

Build from concrete examples to abstract principles. Show 2-3 diverse examples revealing different facets. Include counter-examples. Explain WHY things work, not just WHAT to do. Acknowledge when something is genuinely difficult.`;

  // Pre-Read Guidelines
  const preReadGuidelines = `# Guidelines for Writing Effective Pre-Read Notes

These are **practical, comprehensive rules** for creating pre-read notes that prepare learners for new topics. Pre-reads are **standalone resources** that take students from 0 to 10 on a scale of 100—building foundational awareness, not mastery.

## Core Principles

### Purpose & Positioning

**What Pre-Reads Are:**
- Standalone introductions that orient learners to new concepts
- The foundation that takes students from "What is this?" to "I recognize this and understand why it matters"
- A 10/100 depth resource—like a movie trailer vs. the full movie
- Reading time: **15-20 minutes maximum**

**What Pre-Reads Are NOT:**
- Comprehensive tutorials (that comes with deeper study and practice)
- Materials to be memorized (focus is on recognition and curiosity)
- Prerequisite checklists or homework assignments
- References to future sessions, lectures, or activities

**Success Metric:** A motivated student can read this, feel oriented and curious, and immediately start exploring the topic deeper on their own.

## Structure: The Five-Part Framework

### Part 1: The Big Picture - Why Does This Matter?

**Goal:** Hook readers and establish relevance in the first 2-3 minutes

**Required Elements:**
- **Opening hook:** Start with a real-world app, surprising fact, relatable question, or problem scenario
- **Relevance statement:** Explicitly answer "Why should I care about this?"
- **Career/application context:** Where does this appear in real jobs, products, or projects?
- **Simple analogy or metaphor:** Connect abstract concepts to familiar experiences

**Best Practices:**
- Use apps/products students actually use (Spotify, Instagram, Netflix)
- Make career relevance specific ("Data analysts use this daily to..." not "This is useful in tech")
- Choose analogies from everyday life, not other technical domains
- Avoid starting with definitions—start with curiosity

### Part 2: Your Roadmap Through This Topic

**Goal:** Preview what's coming and create a sense of journey

**Required Elements:**
- List **3-5 subtopics** that will be covered
- Give each a **1-2 sentence preview** that explains what they'll understand
- Use storytelling language: "First we'll explore...", "Then we'll see how...", "Finally, we'll understand..."

**Best Practices:**
- Use active, engaging language (not "We will discuss..." but "You'll discover...")
- Build progression: simple → complex, foundational → applied
- Each preview should spark curiosity, not just describe
- Keep it scannable—students should see the journey at a glance

### Part 3: Key Terms to Listen For

**Goal:** Build vocabulary recognition without requiring memorization

**Required Elements:**
- Select **4-6 essential terms** (not every term, just the most important)
- Define each in **one plain-English sentence** (no jargon in definitions)
- Optional: Add a simple example or analogy for each

**Best Practices:**
- Avoid defining terms with other technical terms
- Use "In simple terms..." or "Think of it as..." framing
- Test: Could a 12-year-old understand your definition?
- Order terms logically (foundational first, then building on each other)

### Part 4: Examples and Concepts in Action

**Goal:** Make abstract ideas concrete through examples

**For Technical Topics (Code-Based):**

**Required Elements:**
- **At least one working code snippet** (copy-paste ready)
- **Line-by-line explanation** using comments
- **"What's happening here" summary** after the code
- Keep code **simple and minimal** (focus on the core concept, not edge cases)

**For Non-Technical Topics (Concept-Based):**

**Required Elements:**
- **Real-world case study or scenario** (2-3 paragraphs)
- **Step-by-step breakdown** of how the concept applies
- **Outcome and analysis** showing why the concept matters

**Best Practices (Both Types):**
- Use real company names and products when possible (authentic > hypothetical)
- Focus on **one concept per example** (don't try to demonstrate everything)
- Explain the "why" not just the "what"
- Make examples relatable to student experience level

### Part 5: Questions to Keep in Mind

**Goal:** Spark curiosity and encourage deeper thinking

**Required Elements:**
- **2-3 open-ended questions** (no yes/no or simple recall questions)
- Questions should prompt **connections, implications, or applications**
- Vary question types: conceptual, application-based, comparative

**Question Types to Use:**
- **Connection questions:** "How might [concept] change the way you think about [familiar thing]?"
- **Application questions:** "If you were building [type of app], where would you use this concept?"
- **Comparison questions:** "What's the difference between [concept A] and [concept B], and when would you choose each?"
- **Implication questions:** "Why might a company prioritize [this approach] over [alternative]?"

**Best Practices:**
- Avoid questions with single "correct" answers
- Questions should be explorable, not testable
- Don't expect students to answer these definitively—they're thinking prompts
- Questions should naturally flow from the content covered

## Style & Presentation Guidelines

### Tone & Voice
- **Conversational and enthusiastic** (like guiding a curious friend)
- **Encouraging, not condescending** (assume students are smart beginners)
- **Confident but humble** (acknowledge when things are genuinely complex)
- **Active voice over passive** ("You'll discover" not "It will be shown that")

**Language Rules:**
- Keep sentences short (15-20 words average)
- Use "you" to speak directly to the reader
- Avoid academic jargon and overly formal language
- If you must use a technical term, define it immediately
- No filler words: "basically," "simply," "just," "obviously"

### Formatting & Readability

**Paragraph Guidelines:**
- **Maximum 2-4 sentences per paragraph**
- One core idea per paragraph
- Use white space generously—break up walls of text

**Use of Lists:**
- Prefer bullet points for attributes, characteristics, or steps
- Use numbered lists only for sequential steps
- Limit lists to 3-5 items (if longer, chunk into categories)

**Headings:**
- Use clear, descriptive headings (not vague like "Overview")
- Maintain hierarchy: H2 for major sections, H3 for subsections
- Headings should be scannable—reader should understand structure from headings alone

**Emphasis:**
- **Bold** for key terms on first mention (use sparingly)
- _Italics_ for examples or "think of it as" phrases
- Use callout boxes strategically

### Cognitive Load Management

**Principles to Follow:**

**1. The Rule of 3-5:**
- Never list more than 5 items without chunking or categorizing
- If you have 7+ items, group them into 2-3 categories

**2. One Concept Per Paragraph:**
- Don't stack multiple abstract ideas in the same paragraph
- Introduce concept → Explain it → Give example → Move on

**3. Provide "Rest Stops":**
- After dense explanations, add a concrete example
- Use analogies as mental breaks from technical details
- Insert callout boxes to vary reading rhythm

**4. Signal Difficulty:**
- Flag challenging sections: "This next part is tricky—take it slow"
- Reassure when appropriate: "This is simpler than it sounds"
- Acknowledge genuine complexity: "This concept has layers—we'll start simple"

**5. Layer Complexity Gradually:**
- Always start with the simplest case
- Add nuance and edge cases incrementally
- Use phrases like "In the basic case..." then "For more complex scenarios..."

**6. Use White Space:**
- Break up text with headings, lists, and spacing
- Avoid paragraphs longer than 5 lines on screen
- Include visual breaks (callouts, code blocks, tables)

## Content Quality Standards

### Learning Outcomes

**Include this section near the beginning:**

**After reading, you'll be able to:**
- Recognize the main concepts when you encounter them
- Understand why this topic matters in real-world applications
- Follow discussions involving these ideas
- Ask informed questions as you explore deeper

**What you won't be able to do (yet):**
- Build complete solutions from scratch
- Handle complex edge cases
- Explain every technical nuance

**Think of this as:** Learning the alphabet before writing essays—you're building the foundation.

### Scope Boundaries

**Be explicit about depth:**

**This pre-read will:**
- Introduce core concepts and vocabulary
- Explain why this topic matters
- Show simple, foundational examples
- Build your curiosity and orientation

**This pre-read will NOT:**
- Teach you everything about the topic
- Cover advanced techniques or edge cases
- Replace hands-on practice
- Require memorization

**Your learning journey:**
- 0/100: Complete beginner ("I've never heard of this")
- **10/100: Oriented** ← This pre-read gets you here
- 60/100: Functional understanding (can apply with guidance)
- 85/100: Confident practitioner (can work independently)

### Self-Assessment Component

**Include this near the end:**

After reading, you should be able to:
- [ ] Explain in one sentence why this topic matters in real-world applications
- [ ] Define the 4-6 key terms in your own words
- [ ] Give at least one example of where you've seen this concept in action
- [ ] Identify what you're most curious to explore deeper

**If you can't:** That's okay! Re-read sections that felt unclear. Focus on the "big picture" rather than memorizing details.

## Quality Assurance Checklist

**Before finalizing, verify:**

### Content Quality
- [ ] Opening hook connects to real-world apps or problems students recognize
- [ ] "Why this matters" is explicit and compelling
- [ ] Roadmap previews 3-5 subtopics with engaging language
- [ ] 4-6 key terms defined in plain English (one sentence each)
- [ ] At least one working code example OR detailed real-world scenario
- [ ] Code/examples focus on one core concept, not everything at once
- [ ] 2-3 open-ended, thought-provoking closing questions

### Scope & Expectations
- [ ] Learning outcomes clearly state what students will/won't be able to do
- [ ] "10/100 depth" framing is explicit (movie trailer analogy used)
- [ ] Self-check section allows students to validate understanding
- [ ] Reading guidance helps students approach material effectively

### Structure & Readability
- [ ] Reading time tested at 15-20 minutes with a beginner
- [ ] Headings allow complete skimming in under 5 minutes
- [ ] Paragraphs are 2-4 sentences maximum
- [ ] White space used generously (no walls of text)
- [ ] Visual elements (diagrams, callouts, tables) used where helpful

### Engagement
- [ ] Concepts connected to familiar experiences or apps
- [ ] At least one analogy from everyday life
- [ ] Career/project relevance made specific and concrete
- [ ] Examples feel authentic (real companies/products when possible)
- [ ] Thought experiments or "pause and think" moments included

### Accessibility
- [ ] Acronyms defined on first use
- [ ] Language globally accessible (no idioms or cultural assumptions)
- [ ] Code works across platforms (or platform differences noted)

### Cognitive Load
- [ ] One concept per paragraph
- [ ] Lists limited to 3-5 items (or chunked if longer)
- [ ] "Rest stops" after dense sections
- [ ] Difficulty signaled where appropriate
- [ ] Complexity layered from simple to nuanced

### Technical Accuracy
- [ ] Code snippets tested and functional
- [ ] Technical explanations accurate but appropriately simplified
- [ ] No unstated prerequisites beyond what's listed
- [ ] Examples demonstrate concepts correctly

### Standalone Quality
- [ ] No references to "the lecture" or future sessions
- [ ] No phrases like "we'll cover this later" or "you'll learn more about this in..."
- [ ] Material feels complete as a self-contained resource
- [ ] Reader could explore topic independently after reading

**Final Principle:** Pre-reads succeed when students finish feeling **curious and oriented**, not overwhelmed or confused. You're not teaching them to swim—you're showing them the pool, explaining why swimming matters, and making them excited to dive in.`;

  // Comprehensive guidelines for each content type
  const comprehensiveGuidelines = [
    {
      name: 'Assignment Guidelines v1',
      contentType: 'ASSIGNMENT' as const,
      guidelines: assignmentGuidelines,
    },
    {
      name: 'Lecture Note Guidelines v1', 
      contentType: 'LECTURE_NOTE' as const,
      guidelines: lectureNotesGuidelines,
    },
    {
      name: 'Pre-Read Guidelines v1',
      contentType: 'PRE_READ' as const,
      guidelines: preReadGuidelines,
    },
  ];

  for (const guideline of comprehensiveGuidelines) {
    // Check if guidelines already exist for this content type
    const existing = await prisma.guidelinesTemplate.findFirst({
      where: { 
        contentType: guideline.contentType,
        isActive: true 
      }
    });

    if (!existing) {
      await prisma.guidelinesTemplate.create({
        data: {
          ...guideline,
          createdById: superAdmin.id,
          isActive: true,
        }
      });
      console.log(`Created comprehensive guidelines template: ${guideline.name}`);
    } else {
      // Update existing guidelines with comprehensive version
      await prisma.guidelinesTemplate.update({
        where: { id: existing.id },
        data: {
          guidelines: guideline.guidelines,
          version: { increment: 1 },
          updatedAt: new Date(),
        }
      });
      console.log(`Updated existing guidelines template: ${guideline.name}`);
    }
  }

  console.log('Comprehensive guidelines seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
