/**
 * seedBlueprint.js
 *
 * Seeds the complete NEET Test Series Blueprint into the TestBlueprint collection.
 * Data sourced from client document: "Test series Blue print (1).docx"
 *
 * Covers all 3 programs:
 *   - Class XI     (10 Minor + 2 Semi Major + 4 Major = 16 tests)
 *   - Class XII    (10 Minor + 2 Semi Major + 6 Major = 18 tests)
 *   - Dropper      (10 Minor + 2 Semi + 12 Major = 24 tests)
 *
 * Run: node scripts/seedBlueprint.js
 * Idempotent — safe to re-run.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const TestBlueprint = require("../models/TestBlueprint.model");

const BLUEPRINT = [

  // ══════════════════════════════════════════════════════════════════
  // CLASS XI — 16 tests
  // ══════════════════════════════════════════════════════════════════

  {
    programType: "class_xi", testCode: "minor_1", testNumber: 1, displayName: "Minor 1",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["Units, Dimensions and Measurement", "Vectors"], coverageDescription: "Units, Dimensions, Vectors" },
      { subject: "chemistry", chapters: ["Some Basic Concepts of Chemistry"], coverageDescription: "Mole Concept" },
      { subject: "biology",   chapters: ["The Living World", "Biological Classification"], coverageDescription: "Living World, Biological Classification" },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_2", testNumber: 2, displayName: "Minor 2",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["Motion in Straight Line", "Motion in Plane"], coverageDescription: "Kinematics" },
      { subject: "chemistry", chapters: ["Structure of Atom", "Periodic Table"], coverageDescription: "Atomic Structure, Periodic Table" },
      { subject: "biology",   chapters: ["Plant Kingdom", "Animal Kingdom"], coverageDescription: "Plant and Animal Kingdom" },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_3", testNumber: 3, displayName: "Minor 3",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["Newtons Laws of Motion", "Friction"], coverageDescription: "Laws of Motion, Friction" },
      { subject: "chemistry", chapters: ["Chemical Bonding"], coverageDescription: "Chemical Bonding" },
      { subject: "biology",   chapters: ["Morphology of Flowering Plants", "Anatomy of Flowering Plants"], coverageDescription: "Morphology and Anatomy of flowering plants" },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_4", testNumber: 4, displayName: "Minor 4",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["Work Energy Power and Collision"], coverageDescription: "Work Energy Power" },
      { subject: "chemistry", chapters: ["Chemical Equilibrium"], coverageDescription: "Chemical Equilibrium" },
      { subject: "biology",   chapters: ["Cell: The Unit of Life", "Cell Cycle and Cell Division"], coverageDescription: "Cell, Cell Cycle" },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_5", testNumber: 5, displayName: "Minor 5",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["System of Particles and Rotational Motion", "Work Energy Power and Collision"], coverageDescription: "COM and Collision" },
      { subject: "chemistry", chapters: ["Ionic Equilibrium"], coverageDescription: "Ionic Equilibrium" },
      { subject: "biology",   chapters: ["Biomolecules"], coverageDescription: "Biomolecules" },
    ],
  },
  {
    programType: "class_xi", testCode: "semi_major_1", testNumber: 6, displayName: "Semi Major 1",
    examType: "semi_major", suggestedDurationMinutes: 90, suggestedQuestionCount: 90,
    isCumulative: true,
    subjectCoverage: [
      { subject: "physics",   isCumulative: true, cumulativeFrom: [1,2,3,4,5], coverageDescription: "Minor 1-5 cumulative", chapters: ["Units, Dimensions and Measurement", "Vectors", "Motion in Straight Line", "Motion in Plane", "Newtons Laws of Motion", "Friction", "Work Energy Power and Collision", "System of Particles and Rotational Motion"] },
      { subject: "chemistry", isCumulative: true, cumulativeFrom: [1,2,3,4,5], coverageDescription: "Minor 1-5 cumulative", chapters: ["Some Basic Concepts of Chemistry", "Structure of Atom", "Periodic Table", "Chemical Bonding", "Chemical Equilibrium", "Ionic Equilibrium"] },
      { subject: "biology",   isCumulative: true, cumulativeFrom: [1,2,3,4,5], coverageDescription: "Minor 1-5 cumulative", chapters: ["The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom", "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Cell: The Unit of Life", "Cell Cycle and Cell Division", "Biomolecules"] },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_6", testNumber: 7, displayName: "Minor 6",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["System of Particles and Rotational Motion"], coverageDescription: "Circular Motion" },
      { subject: "chemistry", chapters: ["Thermodynamics and Thermochemistry", "Redox Reactions"], coverageDescription: "Thermodynamics, Redox" },
      { subject: "biology",   chapters: ["Photosynthesis in Higher Plants", "Respiration in Plants"], coverageDescription: "Photosynthesis, Respiration" },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_7", testNumber: 8, displayName: "Minor 7",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["System of Particles and Rotational Motion"], coverageDescription: "Rotational Motion" },
      { subject: "chemistry", chapters: ["Nomenclature of Organic Compounds", "Reaction Mechanism (General Organic Chemistry)"], coverageDescription: "Classification and Nomenclature (Organic Chemistry)" },
      { subject: "biology",   chapters: ["Plant Growth and Development"], coverageDescription: "Plant Growth" },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_8", testNumber: 9, displayName: "Minor 8",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["Gravitation", "Mechanical Properties of Solids", "Fluid Mechanics", "Surface Tension"], coverageDescription: "Gravitation, Properties of matter" },
      { subject: "chemistry", chapters: ["Isomerism"], coverageDescription: "Isomerism" },
      { subject: "biology",   chapters: ["Structural Organisation in Animals"], coverageDescription: "Structural Organisation" },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_9", testNumber: 10, displayName: "Minor 9",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["Thermal Physics", "Transmission of Heat", "Fluid Mechanics"], coverageDescription: "Thermal Physics, Fluid mechanics" },
      { subject: "chemistry", chapters: ["Reaction Mechanism (General Organic Chemistry)"], coverageDescription: "General Organic Chemistry" },
      { subject: "biology",   chapters: ["Breathing and Exchange of Gases", "Body Fluids and Circulation", "Excretory Products and Their Elimination", "Locomotion and Movement", "Neural Control and Coordination", "Chemical Coordination and Integration"], coverageDescription: "Human Physiology I" },
    ],
  },
  {
    programType: "class_xi", testCode: "minor_10", testNumber: 11, displayName: "Minor 10",
    examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45,
    subjectCoverage: [
      { subject: "physics",   chapters: ["Oscillations (SHM)", "Waves and Sound"], coverageDescription: "Oscillations (SHM), Wave motion" },
      { subject: "chemistry", chapters: ["Hydrocarbons", "Purification and Characterization of Organic Compounds"], coverageDescription: "Hydrocarbons, Purification, Quantitative and Qualitative analysis" },
      { subject: "biology",   chapters: ["Breathing and Exchange of Gases", "Body Fluids and Circulation", "Excretory Products and Their Elimination", "Locomotion and Movement", "Neural Control and Coordination", "Chemical Coordination and Integration"], coverageDescription: "Human Physiology II" },
    ],
  },
  {
    programType: "class_xi", testCode: "semi_major_2", testNumber: 12, displayName: "Semi Major 2",
    examType: "semi_major", suggestedDurationMinutes: 90, suggestedQuestionCount: 90,
    isCumulative: true,
    subjectCoverage: [
      { subject: "physics",   isCumulative: true, cumulativeFrom: [6,7,8,9,10], coverageDescription: "Minor 6-10 cumulative", chapters: ["System of Particles and Rotational Motion", "Gravitation", "Mechanical Properties of Solids", "Fluid Mechanics", "Surface Tension", "Thermal Physics", "Transmission of Heat", "Oscillations (SHM)", "Waves and Sound"] },
      { subject: "chemistry", isCumulative: true, cumulativeFrom: [6,7,8,9,10], coverageDescription: "Minor 6-10 cumulative", chapters: ["Thermodynamics and Thermochemistry", "Redox Reactions", "Nomenclature of Organic Compounds", "Isomerism", "Reaction Mechanism (General Organic Chemistry)", "Hydrocarbons", "Purification and Characterization of Organic Compounds"] },
      { subject: "biology",   isCumulative: true, cumulativeFrom: [6,7,8,9,10], coverageDescription: "Minor 6-10 cumulative", chapters: ["Photosynthesis in Higher Plants", "Respiration in Plants", "Plant Growth and Development", "Structural Organisation in Animals", "Breathing and Exchange of Gases", "Body Fluids and Circulation", "Excretory Products and Their Elimination", "Locomotion and Movement", "Neural Control and Coordination", "Chemical Coordination and Integration"] },
    ],
  },
  { programType: "class_xi", testCode: "major_1", testNumber: 13, displayName: "Major 1", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", isCumulative: true, coverageDescription: "XI First Half", chapters: [] }, { subject: "chemistry", isCumulative: true, coverageDescription: "XI First Half", chapters: [] }, { subject: "biology", isCumulative: true, coverageDescription: "XI First Half", chapters: [] }] },
  { programType: "class_xi", testCode: "major_2", testNumber: 14, displayName: "Major 2", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }, { subject: "chemistry", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }, { subject: "biology", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }] },
  { programType: "class_xi", testCode: "major_3", testNumber: 15, displayName: "Major 3", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }, { subject: "chemistry", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }, { subject: "biology", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }] },
  { programType: "class_xi", testCode: "major_4", testNumber: 16, displayName: "Major 4", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }, { subject: "chemistry", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }, { subject: "biology", isCumulative: true, coverageDescription: "Complete XI", chapters: [] }] },

  // ══════════════════════════════════════════════════════════════════
  // CLASS XII ONGOING — 18 tests
  // ══════════════════════════════════════════════════════════════════

  { programType: "class_xii", testCode: "minor_1", testNumber: 1, displayName: "Minor 1", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Units, Dimensions and Measurement", "Vectors", "Electric Charges and Fields"], coverageDescription: "Vectors, Units + Electrostatics" },
    { subject: "chemistry", chapters: ["Some Basic Concepts of Chemistry", "Structure of Atom"], coverageDescription: "Mole, Atomic" },
    { subject: "biology",   chapters: ["The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom"], coverageDescription: "Living World, Classification, plant kingdom, animal kingdom" },
  ]},
  { programType: "class_xii", testCode: "minor_2", testNumber: 2, displayName: "Minor 2", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Motion in Straight Line", "Motion in Plane", "Current Electricity"], coverageDescription: "Kinematics + Current Electricity" },
    { subject: "chemistry", chapters: ["Chemical Kinetics", "Chemical Equilibrium"], coverageDescription: "Kinetics + Equilibrium" },
    { subject: "biology",   chapters: ["Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health"], coverageDescription: "Sexual reproduction in Flowering plants, Human Reproduction, Reproductive Health" },
  ]},
  { programType: "class_xii", testCode: "minor_3", testNumber: 3, displayName: "Minor 3", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Newtons Laws of Motion", "Friction", "Electric Potential and Capacitance"], coverageDescription: "Laws of Motion + Capacitor" },
    { subject: "chemistry", chapters: ["Periodic Table", "Chemical Bonding"], coverageDescription: "Periodic + Bonding" },
    { subject: "biology",   chapters: ["Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals"], coverageDescription: "Morphology, Anatomy, structural organization in animals" },
  ]},
  { programType: "class_xii", testCode: "minor_4", testNumber: 4, displayName: "Minor 4", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Work Energy Power and Collision", "System of Particles and Rotational Motion", "Moving Charges and Magnetism", "Magnetism and Matter"], coverageDescription: "WEP + Circular + Magnetism" },
    { subject: "chemistry", chapters: ["Solutions and Colligative Properties", "Electrochemistry"], coverageDescription: "Solutions + Electrochemistry" },
    { subject: "biology",   chapters: ["Principles of Inheritance and Variation", "Molecular Basis of Inheritance"], coverageDescription: "Principal of Inheritance, molecular basis of inheritance" },
  ]},
  { programType: "class_xii", testCode: "minor_5", testNumber: 5, displayName: "Minor 5", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Work Energy Power and Collision", "Electromagnetic Induction"], coverageDescription: "Collisions, COM + EMI" },
    { subject: "chemistry", chapters: ["Thermodynamics and Thermochemistry", "Redox Reactions"], coverageDescription: "Thermodynamics + Redox" },
    { subject: "biology",   chapters: ["Cell: The Unit of Life", "Cell Cycle and Cell Division", "Biomolecules", "Breathing and Exchange of Gases", "Body Fluids and Circulation"], coverageDescription: "Cell, cell cycle, Biomolecules, breathing and exchange of gases, body fluids and circulation" },
  ]},
  { programType: "class_xii", testCode: "semi_major_1", testNumber: 6, displayName: "Semi Major 1", examType: "semi_major", suggestedDurationMinutes: 90, suggestedQuestionCount: 90, isCumulative: true, subjectCoverage: [
    { subject: "physics",   isCumulative: true, cumulativeFrom: [1,2,3,4,5], coverageDescription: "Minor 1-5 cumulative", chapters: [] },
    { subject: "chemistry", isCumulative: true, cumulativeFrom: [1,2,3,4,5], coverageDescription: "Minor 1-5 cumulative", chapters: [] },
    { subject: "biology",   isCumulative: true, cumulativeFrom: [1,2,3,4,5], coverageDescription: "Minor 1-5 cumulative", chapters: [] },
  ]},
  { programType: "class_xii", testCode: "minor_6", testNumber: 7, displayName: "Minor 6", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["System of Particles and Rotational Motion", "Alternating Current", "Electromagnetic Waves"], coverageDescription: "Rotation + AC + electromagnetic waves" },
    { subject: "chemistry", chapters: ["P Block Elements Part 2", "Coordination Chemistry", "D and F Block Elements"], coverageDescription: "p-block, Coordination, d&f block elements" },
    { subject: "biology",   chapters: ["Biotechnology Principles and Processes", "Biotechnology and Its Applications", "Organisms and Populations", "Ecosystem", "Biodiversity and Conservation"], coverageDescription: "Biotechnology principles and process, biotechnology and its applications, Organisms and populations, Ecosystem, biodiversity and its conservation" },
  ]},
  { programType: "class_xii", testCode: "minor_7", testNumber: 8, displayName: "Minor 7", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Thermal Physics", "Transmission of Heat", "Ray Optics and Optical Instruments"], coverageDescription: "Thermal physics + Ray Optics and optical instruments" },
    { subject: "chemistry", chapters: ["Nomenclature of Organic Compounds", "Isomerism", "Reaction Mechanism (General Organic Chemistry)", "Purification and Characterization of Organic Compounds"], coverageDescription: "Nomenclature, Isomerism, General Organic Chemistry, Purification and Characterization" },
    { subject: "biology",   chapters: ["Neural Control and Coordination", "Excretory Products and Their Elimination", "Locomotion and Movement", "Chemical Coordination and Integration"], coverageDescription: "Neural control, Excretion products, locomotion and movement, chemical coordination and integration" },
  ]},
  { programType: "class_xii", testCode: "minor_8", testNumber: 9, displayName: "Minor 8", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Mechanical Properties of Solids", "Fluid Mechanics", "Surface Tension", "Wave Optics"], coverageDescription: "Properties of matter and Fluid mechanics + Wave Optics" },
    { subject: "chemistry", chapters: ["Hydrocarbons", "Haloalkanes and Haloarenes"], coverageDescription: "Hydrocarbons, haloalkanes and haloarenes" },
    { subject: "biology",   chapters: ["Evolution", "Human Health and Disease", "Microbes in Human Welfare"], coverageDescription: "Evolution, Human Health and disease, microbes in human welfare" },
  ]},
  { programType: "class_xii", testCode: "minor_9", testNumber: 10, displayName: "Minor 9", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Gravitation", "Oscillations (SHM)", "Dual Nature of Radiation and Matter", "Atoms", "Nuclei"], coverageDescription: "Gravitation + oscillations SHM + Modern physics" },
    { subject: "chemistry", chapters: ["Alcohols Phenols and Ethers", "Aldehydes and Ketones", "Carboxylic Acids and Derivatives"], coverageDescription: "Alcohols phenol ethers, aldehydes, ketones and carboxylic acid" },
    { subject: "biology",   chapters: ["Photosynthesis in Higher Plants", "Respiration in Plants", "Plant Growth and Development", "Breathing and Exchange of Gases", "Body Fluids and Circulation"], coverageDescription: "Plant Physiology (complete)" },
  ]},
  { programType: "class_xii", testCode: "minor_10", testNumber: 11, displayName: "Minor 10", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Waves and Sound", "Semiconductor"], coverageDescription: "Wave + Semiconductor" },
    { subject: "chemistry", chapters: ["Biomolecules", "Amines (Nitrogen Compounds)"], coverageDescription: "Biomolecules, Amines (Nitrogen compounds)" },
    { subject: "biology",   chapters: ["Human Reproduction", "Sexual Reproduction in Flowering Plants", "Evolution"], coverageDescription: "Human Reproduction, sexual reproduction in flowering plants, evolution" },
  ]},
  { programType: "class_xii", testCode: "semi_major_2", testNumber: 12, displayName: "Semi Major 2", examType: "semi_major", suggestedDurationMinutes: 90, suggestedQuestionCount: 90, isCumulative: true, subjectCoverage: [
    { subject: "physics",   isCumulative: true, cumulativeFrom: [6,7,8,9,10], coverageDescription: "Minor 6-10 cumulative", chapters: [] },
    { subject: "chemistry", isCumulative: true, cumulativeFrom: [6,7,8,9,10], coverageDescription: "Minor 6-10 cumulative", chapters: [] },
    { subject: "biology",   isCumulative: true, cumulativeFrom: [6,7,8,9,10], coverageDescription: "Minor 6-10 cumulative", chapters: [] },
  ]},
  { programType: "class_xii", testCode: "major_1", testNumber: 13, displayName: "Major 1", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", coverageDescription: "Complete XI", isCumulative: true, chapters: [] }, { subject: "chemistry", coverageDescription: "Complete XI", isCumulative: true, chapters: [] }, { subject: "biology", coverageDescription: "Complete XI", isCumulative: true, chapters: [] }] },
  { programType: "class_xii", testCode: "major_2", testNumber: 14, displayName: "Major 2", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", coverageDescription: "Complete XII", isCumulative: true, chapters: [] }, { subject: "chemistry", coverageDescription: "Complete XII", isCumulative: true, chapters: [] }, { subject: "biology", coverageDescription: "Complete XII", isCumulative: true, chapters: [] }] },
  { programType: "class_xii", testCode: "major_3", testNumber: 15, displayName: "Major 3", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }, { subject: "chemistry", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }, { subject: "biology", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }] },
  { programType: "class_xii", testCode: "major_4", testNumber: 16, displayName: "Major 4", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }, { subject: "chemistry", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }, { subject: "biology", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }] },
  { programType: "class_xii", testCode: "major_5", testNumber: 17, displayName: "Major 5", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }, { subject: "chemistry", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }, { subject: "biology", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }] },
  { programType: "class_xii", testCode: "major_6", testNumber: 18, displayName: "Major 6", examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true, subjectCoverage: [{ subject: "physics", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }, { subject: "chemistry", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }, { subject: "biology", coverageDescription: "Full NEET", isCumulative: true, chapters: [] }] },

  // ══════════════════════════════════════════════════════════════════
  // DROPPER — 24 tests  (10 Minor + 2 Semi + 12 Major)
  // ══════════════════════════════════════════════════════════════════

  { programType: "dropper", testCode: "m1", testNumber: 1, displayName: "M1", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Units, Dimensions and Measurement", "Vectors", "Electric Charges and Fields"], coverageDescription: "Units and dimensions + Electrostatics + vectors" },
    { subject: "chemistry", chapters: ["Some Basic Concepts of Chemistry", "Structure of Atom"], coverageDescription: "Mole + Atomic" },
    { subject: "biology",   chapters: ["The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom"], coverageDescription: "Living World + Classification, plant kingdom, animal kingdom" },
  ]},
  { programType: "dropper", testCode: "m2", testNumber: 2, displayName: "M2", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Motion in Straight Line", "Motion in Plane", "Current Electricity"], coverageDescription: "Kinematics + Current" },
    { subject: "chemistry", chapters: ["Chemical Kinetics", "Chemical Equilibrium"], coverageDescription: "Kinetics + Equilibrium" },
    { subject: "biology",   chapters: ["Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health"], coverageDescription: "Sexual reproduction in flowering plants, Human Reproduction, reproductive health" },
  ]},
  { programType: "dropper", testCode: "m3", testNumber: 3, displayName: "M3", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Newtons Laws of Motion", "Friction", "Electric Potential and Capacitance"], coverageDescription: "NLM + Friction + Capacitor" },
    { subject: "chemistry", chapters: ["Periodic Table", "Chemical Bonding"], coverageDescription: "Periodic + Bonding" },
    { subject: "biology",   chapters: ["Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals"], coverageDescription: "Morphology of flowering plants, anatomy of flowering plants, structural organization in animals" },
  ]},
  { programType: "dropper", testCode: "m4", testNumber: 4, displayName: "M4", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Work Energy Power and Collision", "System of Particles and Rotational Motion", "Moving Charges and Magnetism", "Magnetism and Matter"], coverageDescription: "WEP + Circular motion + Magnetism (Complete)" },
    { subject: "chemistry", chapters: ["Solutions and Colligative Properties", "Electrochemistry"], coverageDescription: "Solutions + Electrochemistry" },
    { subject: "biology",   chapters: ["Principles of Inheritance and Variation", "Molecular Basis of Inheritance"], coverageDescription: "Principals of Inheritance + molecular basis of inheritance" },
  ]},
  { programType: "dropper", testCode: "m5", testNumber: 5, displayName: "M5", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Work Energy Power and Collision", "Electromagnetic Induction"], coverageDescription: "Collisions and COM + EMI" },
    { subject: "chemistry", chapters: ["Thermodynamics and Thermochemistry", "Redox Reactions"], coverageDescription: "Thermodynamics + Redox" },
    { subject: "biology",   chapters: ["Cell: The Unit of Life", "Cell Cycle and Cell Division", "Breathing and Exchange of Gases", "Body Fluids and Circulation"], coverageDescription: "Cell, cell cycle, breathing and exchange of gases, body fluids and circulation" },
  ]},
  { programType: "dropper", testCode: "m6", testNumber: 6, displayName: "M6", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["System of Particles and Rotational Motion", "Alternating Current", "Electromagnetic Waves"], coverageDescription: "Rotation + AC + Electromagnetic waves" },
    { subject: "chemistry", chapters: ["P Block Elements Part 2", "D and F Block Elements", "Coordination Chemistry"], coverageDescription: "p-block, d and f block, coordination compounds" },
    { subject: "biology",   chapters: ["Biotechnology Principles and Processes", "Biotechnology and Its Applications", "Organisms and Populations", "Ecosystem", "Biodiversity and Conservation"], coverageDescription: "Biotechnology principles and processes, biotechnology and its applications, organisms and populations, ecosystem, biodiversity and its conservation" },
  ]},
  { programType: "dropper", testCode: "semi_1", testNumber: 7, displayName: "Semi 1", examType: "semi_major", suggestedDurationMinutes: 90, suggestedQuestionCount: 90, isCumulative: true, subjectCoverage: [
    { subject: "physics",   isCumulative: true, cumulativeFrom: [1,2,3,4,5,6], coverageDescription: "Minor 1-6 cumulative", chapters: [] },
    { subject: "chemistry", isCumulative: true, cumulativeFrom: [1,2,3,4,5,6], coverageDescription: "Minor 1-6 cumulative", chapters: [] },
    { subject: "biology",   isCumulative: true, cumulativeFrom: [1,2,3,4,5,6], coverageDescription: "Minor 1-6 cumulative", chapters: [] },
  ]},
  { programType: "dropper", testCode: "m7", testNumber: 8, displayName: "M7", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Thermal Physics", "Transmission of Heat", "Ray Optics and Optical Instruments"], coverageDescription: "Thermal physics + Ray optics and optical instruments" },
    { subject: "chemistry", chapters: ["Nomenclature of Organic Compounds", "Isomerism", "Reaction Mechanism (General Organic Chemistry)", "Purification and Characterization of Organic Compounds"], coverageDescription: "Nomenclature, Isomerism, General Organic Chemistry, Purification and Characterization of organic compounds" },
    { subject: "biology",   chapters: ["Neural Control and Coordination", "Locomotion and Movement", "Excretory Products and Their Elimination", "Chemical Coordination and Integration"], coverageDescription: "Neural control and coordination, locomotion and movement, excretory products and their elimination and chemical coordination and integration" },
  ]},
  { programType: "dropper", testCode: "m8", testNumber: 9, displayName: "M8", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Mechanical Properties of Solids", "Fluid Mechanics", "Surface Tension", "Wave Optics"], coverageDescription: "Properties of matter and Fluid mechanics + Wave optics" },
    { subject: "chemistry", chapters: ["Hydrocarbons", "Haloalkanes and Haloarenes"], coverageDescription: "Hydrocarbons, haloalkanes and haloarenes" },
    { subject: "biology",   chapters: ["Human Health and Disease", "Evolution", "Microbes in Human Welfare"], coverageDescription: "Human Health and disease, evolution, microbes in human welfare" },
  ]},
  { programType: "dropper", testCode: "m9", testNumber: 10, displayName: "M9", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Gravitation", "Oscillations (SHM)", "Dual Nature of Radiation and Matter", "Atoms", "Nuclei"], coverageDescription: "Gravitation + Oscillations (SHM) + Modern Physics" },
    { subject: "chemistry", chapters: ["Alcohols Phenols and Ethers", "Aldehydes and Ketones", "Carboxylic Acids and Derivatives"], coverageDescription: "Alcohols phenols and ethers + Aldehydes, ketones and carboxylic acids" },
    { subject: "biology",   chapters: ["Photosynthesis in Higher Plants", "Respiration in Plants", "Plant Growth and Development", "Breathing and Exchange of Gases", "Body Fluids and Circulation"], coverageDescription: "Plant Physiology (Complete)" },
  ]},
  { programType: "dropper", testCode: "m10", testNumber: 11, displayName: "M10", examType: "minor", suggestedDurationMinutes: 60, suggestedQuestionCount: 45, subjectCoverage: [
    { subject: "physics",   chapters: ["Waves and Sound", "Semiconductor"], coverageDescription: "Wave Motion + Semiconductor" },
    { subject: "chemistry", chapters: ["Biomolecules", "Amines (Nitrogen Compounds)"], coverageDescription: "Biomolecules, Nitrogen compounds (Amines)" },
    { subject: "biology",   chapters: ["Human Reproduction", "Sexual Reproduction in Flowering Plants", "Evolution"], coverageDescription: "Human Reproduction, sexual reproduction in flowering plants, evolution" },
  ]},
  { programType: "dropper", testCode: "semi_2", testNumber: 12, displayName: "Semi 2", examType: "semi_major", suggestedDurationMinutes: 90, suggestedQuestionCount: 90, isCumulative: true, subjectCoverage: [
    { subject: "physics",   isCumulative: true, cumulativeFrom: [7,8,9,10], coverageDescription: "Minor 7-10 cumulative", chapters: [] },
    { subject: "chemistry", isCumulative: true, cumulativeFrom: [7,8,9,10], coverageDescription: "Minor 7-10 cumulative", chapters: [] },
    { subject: "biology",   isCumulative: true, cumulativeFrom: [7,8,9,10], coverageDescription: "Minor 7-10 cumulative", chapters: [] },
  ]},
  ...Array.from({ length: 12 }, (_, k) => ({
    programType: "dropper", testCode: `major_${k + 1}`, testNumber: 13 + k, displayName: `Major ${k + 1}`,
    examType: "major", suggestedDurationMinutes: 180, suggestedQuestionCount: 180, isCumulative: true,
    subjectCoverage: [
      { subject: "physics",   isCumulative: true, coverageDescription: k === 0 ? "Complete XI" : k === 1 ? "Complete XII" : `Full Syllabus Simulation ${k - 1}`, chapters: [] },
      { subject: "chemistry", isCumulative: true, coverageDescription: k === 0 ? "Complete XI" : k === 1 ? "Complete XII" : `Full Syllabus Simulation ${k - 1}`, chapters: [] },
      { subject: "biology",   isCumulative: true, coverageDescription: k === 0 ? "Complete XI" : k === 1 ? "Complete XII" : `Full Syllabus Simulation ${k - 1}`, chapters: [] },
    ],
  })),
];

async function seedBlueprint() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("[DB] Connected.");

    let inserted = 0, updated = 0;

    for (const entry of BLUEPRINT) {
      const result = await TestBlueprint.updateOne(
        { programType: entry.programType, testCode: entry.testCode },
        { $set: entry },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else if (result.modifiedCount > 0) updated++;
    }

    console.log(`\n✅ Blueprint seeding complete.`);
    console.log(`   Total entries: ${BLUEPRINT.length}`);
    console.log(`   Inserted: ${inserted}  |  Updated: ${updated}`);

    const stats = await TestBlueprint.aggregate([
      { $group: { _id: { programType: "$programType", examType: "$examType" }, count: { $sum: 1 } } },
      { $sort: { "_id.programType": 1, "_id.examType": 1 } },
    ]);
    console.log("\n📊 Tests per program × type:");
    for (const s of stats) {
      console.log(`   ${s._id.programType.padEnd(12)} ${s._id.examType.padEnd(12)} → ${s.count} tests`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("[Seed] Error:", err.message);
    process.exit(1);
  }
}

seedBlueprint();
