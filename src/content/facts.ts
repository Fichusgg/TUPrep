/** Official facts shown on the Exam info page (checked 24 Oct 2026). Dates themselves live in config/schedule.config.ts. */
export const FACTS = {
  delft: {
    title: "TU Delft — Cognitive Skills Test (CST), BSc CSE 2027-2028",
    points: [
      "The CST has two tests: Mathematics (50%, 1 hour) and Systematic Reasoning & Logical Thinking (50%, 45 minutes) — 1 h 45 min in one session; each test shows a countdown.",
      "Online and proctored on your own computer on Thursday 18 or Tuesday 23 February 2027 (10:00–22:00 CET); one on-campus option. You give a date preference; TU Delft confirms your date before 9 February.",
      "No calculator; answers must be exact (no rounding). A formula sheet (trig identities, standard integrals) is available digitally during the test.",
      "Preparation named by TU Delft: DelftX Pre-University Calculus + the syllabus/formula sheet (maths) and chapter 2 of Delftse Foundations of Computation (SR&LT). Most candidates spend 15–25 hours.",
      "Proctoring trial run: 9–16 February. Preparation lecture: week of 2 February. Teamwork Assignment: 2–9 March. Ranking numbers: 15 April.",
      "Scores of the two tests are normalised per track and combined; your place on the score list decides your lottery category (English track: top 210 → cat. 1, next 540 → cat. 2, rest → cat. 3; Bilingual: 150 / 350 / rest). The final number is drawn within the category.",
      "Capacity 590: 345 English track + 245 Bilingual track. High-school grades are not used.",
      "Change versus earlier years: the 2025-2026 CST had three parts (Mathematics 40%, SR&LT 35%, Problem Solving 25%). For 2027-2028 the algorithmic/problem-solving part is gone — algorithmic thinking now matters only for TU/e.",
    ],
    sources: [
      ["Brochure 2 — Matching & Selection 2027-2028 (v2)", "https://filelist.tudelft.nl/TUDelft/Onderwijs/Opleidingen/Bachelor/Computer%20science%20engineering/selectieprocedure/Brochure%202%20Matching%20_%20Selection%20BSc%20CSE%202027-2028%20v2.pdf"],
      ["Regulation Matching & Selection 2027-2028", "https://filelist.tudelft.nl/TUDelft/Onderwijs/Opleidingen/Bachelor/Computer%20science%20engineering/selectieprocedure/Regulation%20CSE%20MS%202027-2028.pdf"],
      ["TU Delft CSE selection procedure page", "https://www.tudelft.nl/en/onderwijs/opleidingen/bachelors/computer-science-and-engineering/bachelor-of-computer-science-and-engineering/from-application-to-enrollment/selection-procedure"],
    ],
  },
  tue: {
    title: "TU/e — selection tests, BSc CSE 2027-2028",
    points: [
      "Capacity 375. Ranking = 10% average VWO grade (or equivalent) + 90% cognitive skills tests: Mathematics 10%, Logical Reasoning 40%, Algorithmic Thinking 40%. All results are converted to standard scores first.",
      "The three tests take place online on Saturday 6 March 2027 (one mandatory selection day), proctored with Pruefster. 3 hours of testing in total plus up to 1 hour of optional breaks.",
      "Also required: the motivation & capacities questionnaire (by 14 February 2027). Missing it excludes you from ranking.",
      "Ties are broken by the grade average, then by lot. Ranking numbers: 15 April 2027; accept an offer within 14 days.",
      "Practice: a practice environment during the procedure, Wistue for maths, and the Online Study Experience modules.",
      "Per-test question counts and durations are not published — this site assumes 60 minutes and 20–25 questions per test (ESTIMATED).",
    ],
    sources: [
      ["Departmental regulations selection CSE 2027-2028", "https://assets.w3.tue.nl/w/fileadmin/mathematics%20and%20computer%20science/M%26CS/Education%20programs/Selection%20procedure/2027-2028/Departmental%20regulations%20selection%20for%20the%20bachelor%20Computer%20Science%20and%20Engineering%202027-2028.pdf"],
      ["BCS important dates and deadlines", "https://assets.w3.tue.nl/w/fileadmin/mathematics%20and%20computer%20science/M%26CS/Education%20programs/Selection%20procedure/2027-2028/BCS%20important%20dates%20and%20deadlines%20ENG.pdf"],
      ["TU/e CSE selection procedure page", "https://www.tue.nl/en/education/bachelor-college/bachelor-computer-science-and-engineering/selection-procedure/"],
    ],
  },
} as const;
