/**
 * seedSyllabus.js
 *
 * Seeds the complete NEET syllabus taxonomy into SyllabusConfig collection.
 * Data sourced from client-provided Nomenclature documents:
 *   - Nomenclature for topics (Physics XI + XII)
 *   - Revised Biology Nomenclature (NEET)
 *   - Nomenclature – Chemistry
 *
 * Run: node scripts/seedSyllabus.js
 *
 * Idempotent — uses upsert so it can be re-run safely after edits.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const SyllabusConfig = require("../models/SyllabusConfig.model");

// ─── Complete NEET Syllabus Data ──────────────────────────────────────────────

const SYLLABUS = [

  // ══════════════════════════════════════════════════════════════════
  // PHYSICS — CLASS XI
  // ══════════════════════════════════════════════════════════════════

  // U1 – Units, Dimensions and Measurement
  ...["Units", "Dimensions", "Measurement", "Errors of measurement", "Significant digit", "Vernier calipers, micrometer, screw gauge"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U1", chapter: "Units, Dimensions and Measurement", chapterOrder: 1, topic, topicOrder: i + 1 })),

  // U2 – Motion in straight line
  ...["Average velocity and average speed", "Instantaneous velocity and speed", "Acceleration", "Uniformly accelerated motion", "Motion under gravity", "Relative motion", "Graphical questions"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U2", chapter: "Motion in Straight Line", chapterOrder: 2, topic, topicOrder: i + 1 })),

  // U3.1 – Vectors
  ...["Addition and subtraction of vectors", "Multiplication of vectors"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U3.1", chapter: "Vectors", chapterOrder: 3, topic, topicOrder: i + 1 })),

  // U3.2 – Motion in Plane
  ...["Motion in two and three dimensions", "Relative velocity", "Horizontal projectile motion", "Oblique projectile motion", "Uniform circular motion", "Non-uniform circular motion"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U3.2", chapter: "Motion in Plane", chapterOrder: 4, topic, topicOrder: i + 1 })),

  // U4 – Newtons Laws of Motion
  ...["Newtons first law mass and inertia", "Second law of motion", "Third law of motion and momentum and impulse", "Conservation of linear momentum", "The forces and equilibrium of forces", "Pulley block system", "Apparent weight and pseudo force", "Motion of connected bodies"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U4", chapter: "Newtons Laws of Motion", chapterOrder: 5, topic, topicOrder: i + 1 })),

  // U4.2 – Friction
  ...["Static and limiting friction", "Motion on inclined surface"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U4.2", chapter: "Friction", chapterOrder: 6, topic, topicOrder: i + 1 })),

  // U5 – Work, Energy, Power and Collision
  ...["Work done by constant force", "Work done by variable force", "Kinetic energy", "Work energy theorem", "Conservative and non-conservative forces", "Conservation of energy and momentum", "Vertical circular motion", "Power", "Elastic and inelastic collision", "Perfectly inelastic collision"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U5", chapter: "Work Energy Power and Collision", chapterOrder: 7, topic, topicOrder: i + 1 })),

  // U6 – System of Particles and Rotational Motion
  ...["Centre of mass", "Motion of Centre of mass", "Angular displacement velocity and acceleration", "Moment of inertia and radius of gyration", "Torque and couple", "Rotational Equilibrium", "Conservation of angular momentum", "Kinetic energy conservation and work", "Rolling motion", "Rolling on inclined plane"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U6", chapter: "System of Particles and Rotational Motion", chapterOrder: 8, topic, topicOrder: i + 1 })),

  // U7 – Gravitation
  ...["Newtons Law of gravitation", "Acceleration due to gravity", "Gravitational Intensity", "Gravitational Potential", "Gravitational Potential Energy Energy Conservation", "Escape Velocity and Escape Energy", "Motion of satellites in circular orbits and planets in elliptical orbits", "Keplers laws of planetary motion"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U7", chapter: "Gravitation", chapterOrder: 9, topic, topicOrder: i + 1 })),

  // U8 – Mechanical Properties of Solids
  ...["Basic of elasticity stress and strain", "Youngs Modulus", "Bulk Modulus", "Work done in stretching a wire"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U8", chapter: "Mechanical Properties of Solids", chapterOrder: 10, topic, topicOrder: i + 1 })),

  // U9.1 – Fluid Mechanics
  ...["Pressure due to Liquid column and barometer", "Buoyancy Archimedes principle and laws of floatation", "Velocity of efflux and Torricellis law", "Newtons law of viscosity", "Viscosity and stokes law and terminal velocity"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U9.1", chapter: "Fluid Mechanics", chapterOrder: 11, topic, topicOrder: i + 1 })),

  // U9.2 – Surface Tension
  ...["Surface tension", "Surface energy", "Excess Pressure", "Angle of contact", "Capillary tube and capillarity"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U9.2", chapter: "Surface Tension", chapterOrder: 12, topic, topicOrder: i + 1 })),

  // U10.1 – Thermal Physics
  ...["Thermal Expansion", "Specific heat and heat capacity", "Principle of calorimetry and water equivalent"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U10.1", chapter: "Thermal Physics", chapterOrder: 13, topic, topicOrder: i + 1 })),

  // U10.2 – Transmission of Heat
  ...["Thermal conductivity and thermal resistance", "Radiation by Stefans Boltzmann law", "Newtons law of cooling", "Spectral emissive power and weins displacement law"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U10.2", chapter: "Transmission of Heat", chapterOrder: 14, topic, topicOrder: i + 1 })),

  // U11 – Thermodynamics
  ...["First law of thermodynamics", "Adiabatic process", "Polytropic process", "Work done and internal energy", "Heat engine and carnot cycle", "Refrigerator"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U11", chapter: "Thermodynamics", chapterOrder: 15, topic, topicOrder: i + 1 })),

  // U12 – Kinetic Theory of Gases
  ...["Ideal gas concept", "Gas laws", "Pressure and energy", "Speed of gas", "Degree of freedom", "Molar specific heat of gas and mayers law", "Mean free path and real gases"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U12", chapter: "Kinetic Theory of Gases", chapterOrder: 16, topic, topicOrder: i + 1 })),

  // U13 – Oscillations (SHM)
  ...["Periodic Oscillatory motion and its characteristics and types of SHM", "Position of a particle in SHM Displacement and phase", "Velocity of simple harmonic motion", "Acceleration of simple harmonic motion", "Energy of simple harmonic motion", "Method to determine time period and frequency", "Spring mass system", "Simple pendulum", "Superposition of SHM"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U13", chapter: "Oscillations (SHM)", chapterOrder: 17, topic, topicOrder: i + 1 })),

  // U14 – Waves and Sound
  ...["Introduction and classification of waves", "Wave equation and characteristics of waves", "Speed of mechanical wave on string", "Beats", "Transverse stationary waves and sonometer", "Longitudinal stationary waves and resonance tube", "Dopplers Effect"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XI", unitCode: "U14", chapter: "Waves and Sound", chapterOrder: 18, topic, topicOrder: i + 1 })),

  // ══════════════════════════════════════════════════════════════════
  // PHYSICS — CLASS XII
  // ══════════════════════════════════════════════════════════════════

  // U1 – Electric Charges and Fields
  ...["Electric charge its properties and method of charging", "Coulombs law", "Motion of charge particles in electric field", "Electric field lines Electric flux and gauss law", "Electric field and usage of gauss law", "Electric dipole and electric field"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U1", chapter: "Electric Charges and Fields", chapterOrder: 1, topic, topicOrder: i + 1 })),

  // U2 – Electric Potential and Capacitance
  ...["Electric Potential", "Electric field and potential and potential gradient", "Equipotential surface", "Electric potential and potential energy and dipole", "Potential energy and work done", "Conductor Electrostatic shielding induced charge and charge redistribution", "Parallel plate capacitor", "Combination of capacitor and sharing of charge", "Energy stored in a capacitor", "Effect of dielectric and dielectric inside capacitor and polarization"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U2", chapter: "Electric Potential and Capacitance", chapterOrder: 2, topic, topicOrder: i + 1 })),

  // U3 – Current Electricity
  ...["Electric current and current density drift velocity and relaxation time", "Ohms law and resistance resistivity and conductivity", "Carbon resistors and color code", "Equivalent resistance and combination of resistors", "Electric cells and combination of cells in series and parallel", "Kirchoffs law", "Meter bridge", "Potentiometer", "Electrical energy and power"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U3", chapter: "Current Electricity", chapterOrder: 3, topic, topicOrder: i + 1 })),

  // U4 – Moving Charges and Magnetism
  ...["Biot Savart law and its application", "Amperes circuital law and its application", "Motion of charged particles in magnetic field and Lorentz force", "Force on a current carrying conductor", "Magnetic moment of current carrying coil and torque", "The moving coil galvanometer and ammeter and voltmeter conversion", "Cyclotron", "Mix examples magnetic effect of current"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U4", chapter: "Moving Charges and Magnetism", chapterOrder: 4, topic, topicOrder: i + 1 })),

  // U5 – Magnetism and Matter
  ...["Bar magnet and magnetic dipole", "Magnetic dipole in magnetic field", "Earth magnetism", "Magnetic equipment", "Magnetization", "Magnetic materials", "Magnetic Hysteresis"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U5", chapter: "Magnetism and Matter", chapterOrder: 5, topic, topicOrder: i + 1 })),

  // U6 – Electromagnetic Induction
  ...["Magnetic Flux", "Faradays and Lenzs law", "Motional EMF", "Self-induction", "Mutual induction", "Dynamic EMI and periodic EMI", "Energy stored in inductor", "Combination of inductor", "R-L DC Circuit", "Static EMI", "Transformer", "Application of EMI Motor", "Eddy Current", "Mix examples electromagnetic induction"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U6", chapter: "Electromagnetic Induction", chapterOrder: 6, topic, topicOrder: i + 1 })),

  // U7 – Alternating Current
  ...["Alternating current Voltage", "Different types of AC Circuit", "Inductance capacitance and resistance in series and parallel", "Phase and impedance reactance admittance and susceptance", "Power in AC and Power factors", "Half power frequency quality factor resonance in AC circuit", "LC Oscillations"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U7", chapter: "Alternating Current", chapterOrder: 7, topic, topicOrder: i + 1 })),

  // U8 – Electromagnetic Waves
  ...["Maxwells equations and concept of displacement current", "Hertz experiment", "Properties of electromagnetic waves", "Electromagnetic spectrum"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U8", chapter: "Electromagnetic Waves", chapterOrder: 8, topic, topicOrder: i + 1 })),

  // U9 – Ray Optics and Optical Instruments
  ...["Plane Mirror", "Angle of deviation and rotation of plane mirror", "Spherical mirror", "Combination of mirrors and cutting of mirror", "Refraction of light", "Refraction through plane surface and glass slab", "Critical angle and total internal reflection", "Refraction through single curved surface", "Refraction by lenses", "Combination of lenses", "Combination of lens and mirror and silvering of lens", "Refraction through prism", "Dispersion of light", "Aberrations in optical elements", "Human eye and defects of vision", "Microscope", "Telescope", "Scattering of light", "Some natural phenomena of sunlight"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U9", chapter: "Ray Optics and Optical Instruments", chapterOrder: 9, topic, topicOrder: i + 1 })),

  // U10 – Wave Optics
  ...["Huygens principle and wave fronts", "Wave nature and interference of light", "Youngs double slit experiment", "Variations in YDSE", "Dopplers effect of lights", "Thin film interference", "Single slit diffraction of light", "Fresnel distance and Rayleigh criterion", "Resolving power", "Polarization of light and malus law", "Brewsters law and other methods of polarization", "Mix examples Wave optics"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U10", chapter: "Wave Optics", chapterOrder: 10, topic, topicOrder: i + 1 })),

  // U11 – Dual Nature of Radiation and Matter
  ...["Cathode rays and positive rays", "Einsteins Quantum theory of light", "Radiation force and pressure", "Photoelectric effect by lenard and its observations", "Einsteins photoelectric equation", "Matter waves and de broglie wavelength", "Photon and Photoelectric Effect", "Davisson Germer experiment and heisenbergs uncertainty principle"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U11", chapter: "Dual Nature of Radiation and Matter", chapterOrder: 11, topic, topicOrder: i + 1 })),

  // U12 – Atoms
  ...["Atomic models and scattering of alpha particle", "Bohrs model of hydrogen atom", "Electron energy and electron energy levels in hydrogen atom", "Spectral series of hydrogen atom", "X-rays"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U12", chapter: "Atoms", chapterOrder: 12, topic, topicOrder: i + 1 })),

  // U13 – Nuclei
  ...["Composition of nucleus size of the nucleus nuclear force", "Mass energy nuclear binding energy nuclear stability", "Nuclear fission fusion and nuclear reactor", "Properties of alpha beta and gamma rays and decay process"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U13", chapter: "Nuclei", chapterOrder: 13, topic, topicOrder: i + 1 })),

  // U14 – Semiconductor
  ...["Classification of materials and energy band theory", "Types of semiconductors", "PN Junction and diode", "Application of junction diode rectifier", "Light emitting diode LED photo diode solar cell", "Zener Diode", "Junction Transistor", "Boolean algebra and logic gates", "Valve electronics"]
    .map((topic, i) => ({ subject: "physics", classLevel: "XII", unitCode: "U14", chapter: "Semiconductor", chapterOrder: 14, topic, topicOrder: i + 1 })),

  // ══════════════════════════════════════════════════════════════════
  // CHEMISTRY — CLASS XI
  // ══════════════════════════════════════════════════════════════════

  // U1 – Some Basic Concepts of Chemistry (Mole Concept)
  ...["Laws of chemical combination", "The mole concept", "Atomic molecular and equivalent masses", "Percentage composition and molecular formula", "Chemical equation and limiting reagent", "Chemical stoichiometry"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U1", chapter: "Some Basic Concepts of Chemistry", chapterOrder: 1, topic, topicOrder: i + 1 })),

  // U2 – Structure of Atom
  ...["Atomic number mass number atomic species", "Nature of radiation", "Atomic models and Plancks quantum theory", "De Broglies principle", "Quantum number electronic configuration and shape of orbitals"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U2", chapter: "Structure of Atom", chapterOrder: 2, topic, topicOrder: i + 1 })),

  // U3 – Periodic Table
  ...["Extended or long form of periodic table", "Atomic and ionic radii", "Ionization energy", "Electron affinity", "Electronegativity", "Chemical reactivity"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U3", chapter: "Periodic Table", chapterOrder: 3, topic, topicOrder: i + 1 })),

  // U4 – Chemical Bonding
  ...["Polarization and Fajans rule", "Covalent bonding", "Co-ordinate or Dative Bonding", "Dipole moment", "Hybridization", "VSEPR theory", "Molecular orbital theory", "Hydrogen bonding", "Types of bonding and forces in solid"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U4", chapter: "Chemical Bonding", chapterOrder: 4, topic, topicOrder: i + 1 })),

  // U5 – Thermodynamics and Thermochemistry
  ...["Basic concepts", "First law of thermodynamics and Hess law", "Heat capacity", "Heat of reaction", "2nd and 3rd law of thermodynamics and entropy", "Free energy and work function", "Bond energy"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U5", chapter: "Thermodynamics and Thermochemistry", chapterOrder: 5, topic, topicOrder: i + 1 })),

  // U6.1 – Chemical Equilibrium
  ...["Equilibrium state and characteristics of K", "Law of equilibrium and equilibrium constant", "Kp and Kc Relationship", "Standard free energy", "Le-Chatelier principle and its application"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U6.1", chapter: "Chemical Equilibrium", chapterOrder: 6, topic, topicOrder: i + 1 })),

  // U6.2 – Ionic Equilibrium
  ...["Electric conductors and Ostwalds dilution law", "Acids and bases", "Water hydrolysis and PH scale", "PH of strong acids and strong bases", "PH of weak acids and weak bases", "Salt hydrolysis", "Solubility product", "Common ion effect", "Buffer solution", "Acid and base indicators"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U6.2", chapter: "Ionic Equilibrium", chapterOrder: 7, topic, topicOrder: i + 1 })),

  // U7 – Redox Reactions
  ...["Oxidation reduction", "Oxidizing and reducing agent", "Oxidation number and oxidation state", "Auto oxidation and disproportionation"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U7", chapter: "Redox Reactions", chapterOrder: 8, topic, topicOrder: i + 1 })),

  // U8.1 – Nomenclature of Organic Compounds
  ...["Bonding and hybridization in organic compounds", "Nomenclature of organic compounds"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U8.1", chapter: "Nomenclature of Organic Compounds", chapterOrder: 9, topic, topicOrder: i + 1 })),

  // U8.2 – Isomerism
  ...["Structural isomerism", "Conformational isomerism", "Geometrical isomerism", "Optical isomerism"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U8.2", chapter: "Isomerism", chapterOrder: 10, topic, topicOrder: i + 1 })),

  // U8.3 – Purification and Characterization
  ...["Purification of organic compounds", "Quantitative analysis", "Qualitative analysis", "Chemical analysis of organic compounds"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U8.3", chapter: "Purification and Characterization of Organic Compounds", chapterOrder: 11, topic, topicOrder: i + 1 })),

  // U8.4 – Reaction Mechanism
  ...["Attacking reagents", "Reactive intermediates", "Electronic displacement in covalent bond", "Types of organic reactions"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U8.4", chapter: "Reaction Mechanism (General Organic Chemistry)", chapterOrder: 12, topic, topicOrder: i + 1 })),

  // U9 – Hydrocarbon
  ...["Aromatic Hydrocarbon", "Alkyne", "Alkene", "Alkane"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U9", chapter: "Hydrocarbons", chapterOrder: 13, topic, topicOrder: i + 1 })),

  // U10 – P block elements -1
  ...["Boron Family", "Carbon Family"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XI", unitCode: "U10", chapter: "P Block Elements Part 1", chapterOrder: 14, topic, topicOrder: i + 1 })),

  // ══════════════════════════════════════════════════════════════════
  // CHEMISTRY — CLASS XII
  // ══════════════════════════════════════════════════════════════════

  // U1 – Solutions
  ...["Solubility", "Method of expressing concentration of solutions", "Colligative properties", "Lowering of vapor pressure", "Ideal and non-ideal solution", "Azeotropic mixture", "Elevation of boiling point of the solvent", "Depression of freezing point of solvent", "Osmosis and osmotic pressure of the solution", "Abnormal molecular mass"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U1", chapter: "Solutions and Colligative Properties", chapterOrder: 1, topic, topicOrder: i + 1 })),

  // U2 – Electrochemistry
  ...["Electrolytes and Electrolysis", "Faradays law of electrolysis", "Conductor and conductance and cell constant", "Electrochemical cells", "Electrode potential Ecell Nernst equation and ECS", "Corrosion"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U2", chapter: "Electrochemistry", chapterOrder: 2, topic, topicOrder: i + 1 })),

  // U3 – Chemical Kinetics
  ...["Rate of reaction", "Rate law rate constant order of reaction and molecularity", "Zero order reaction", "First order reaction", "Collision theory Energy of activation and Arrhenius equation"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U3", chapter: "Chemical Kinetics", chapterOrder: 3, topic, topicOrder: i + 1 })),

  // U4 – D & F Block Elements
  ...["General characteristics", "Physical properties", "Compounds of transitional elements", "Lanthanoids and actinoids"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U4", chapter: "D and F Block Elements", chapterOrder: 4, topic, topicOrder: i + 1 })),

  // U5 – Coordination Chemistry
  ...["Basic terms", "Nomenclature Oxidation state and EAN number", "Isomerism and magnetic properties", "Hybridization and geometry", "Complexes and complex stability", "Crystal field theory", "Organometallic compounds", "Application of co-ordination compounds"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U5", chapter: "Coordination Chemistry", chapterOrder: 5, topic, topicOrder: i + 1 })),

  // U6 – Haloalkanes and Haloarenes
  ...["Introduction to halogen containing compounds", "Preparation of haloalkanes", "Preparation of haloarenes", "Properties of haloalkanes and haloarenes", "Uses of halogen containing compounds"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U6", chapter: "Haloalkanes and Haloarenes", chapterOrder: 6, topic, topicOrder: i + 1 })),

  // U7 – Alcohol, Phenol and Ethers
  ...["General introduction of alcohol phenol and ethers", "Preparation of alcohol", "Properties of alcohol", "Preparation of phenols", "Properties of phenols", "Preparation of ethers", "Properties of ethers"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U7", chapter: "Alcohols Phenols and Ethers", chapterOrder: 7, topic, topicOrder: i + 1 })),

  // U8.1 – Aldehydes and Ketones
  ...["Preparation of Aldehydes", "Properties of Aldehydes", "Preparation of ketones", "Properties of ketones"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U8.1", chapter: "Aldehydes and Ketones", chapterOrder: 8, topic, topicOrder: i + 1 })),

  // U8.2 – Carboxylic Acid
  ...["Preparation of carboxylic acid and its derivatives", "Properties of carboxylic acid and its derivatives"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U8.2", chapter: "Carboxylic Acids and Derivatives", chapterOrder: 9, topic, topicOrder: i + 1 })),

  // U9 – Amines (Nitrogen Compounds)
  ...["Preparation of Amines", "Properties of Amines"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U9", chapter: "Amines (Nitrogen Compounds)", chapterOrder: 10, topic, topicOrder: i + 1 })),

  // U10 – Biomolecules
  ...["Carbohydrates", "Amino acids and proteins", "Enzymes and hormones", "Vitamins", "Nucleic acids"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U10", chapter: "Biomolecules", chapterOrder: 11, topic, topicOrder: i + 1 })),

  // U11 – P block elements -2
  ...["Nitrogen Family", "Oxygen Family", "Halogen Family", "Noble gases"]
    .map((topic, i) => ({ subject: "chemistry", classLevel: "XII", unitCode: "U11", chapter: "P Block Elements Part 2", chapterOrder: 12, topic, topicOrder: i + 1 })),

  // ══════════════════════════════════════════════════════════════════
  // BIOLOGY — CLASS XI
  // ══════════════════════════════════════════════════════════════════

  // U1 – The Living World
  ...["Introduction to Living World", "Diversity in the Living World", "Taxonomic Categories", "Taxonomical Aids"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U1", chapter: "The Living World", chapterOrder: 1, topic, topicOrder: i + 1 })),

  // U2 – Biological Classification
  ...["Introduction", "Monera", "Protista", "Fungi", "Viruses Viroids Prions and Lichens"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U2", chapter: "Biological Classification", chapterOrder: 2, topic, topicOrder: i + 1 })),

  // U3 – Plant Kingdom
  ...["Algae", "Bryophytes", "Pteridophytes", "Gymnosperms", "Angiosperms", "Plant Life Cycles and Alternation of Generations"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U3", chapter: "Plant Kingdom", chapterOrder: 3, topic, topicOrder: i + 1 })),

  // U4 – Animal Kingdom
  ...["Basis of Classification", "Porifera", "Cnidaria (Coelenterata)", "Ctenophora", "Platyhelminthes", "Aschelminthes (Nematoda)", "Annelida", "Arthropoda", "Mollusca", "Echinodermata", "Hemichordata", "Chordata", "Cyclostomata", "Chondrichthyes", "Osteichthyes", "Amphibia", "Reptilia", "Aves", "Mammalia"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U4", chapter: "Animal Kingdom", chapterOrder: 4, topic, topicOrder: i + 1 })),

  // U5 – Morphology of Flowering Plants
  ...["Root", "Stem", "Leaf", "Inflorescence", "Flower", "Fruit", "Seed", "Semi-technical Description", "Important Families"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U5", chapter: "Morphology of Flowering Plants", chapterOrder: 5, topic, topicOrder: i + 1 })),

  // U6 – Anatomy of Flowering Plants
  ...["Meristematic Tissue", "Permanent Tissue", "Tissue System", "Internal Structure of Root", "Internal Structure of Stem", "Internal Structure of Leaf", "Secondary Growth"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U6", chapter: "Anatomy of Flowering Plants", chapterOrder: 6, topic, topicOrder: i + 1 })),

  // U7 – Structural Organisation in Animals
  ...["Epithelial Tissue", "Connective Tissue", "Muscular Tissue", "Neural Tissue", "Cockroach Morphology", "Cockroach Anatomy", "Frog Morphology", "Frog Anatomy"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U7", chapter: "Structural Organisation in Animals", chapterOrder: 7, topic, topicOrder: i + 1 })),

  // U8 – Cell: The Unit of Life
  ...["Overview of Cell", "Prokaryotic Cell", "Eukaryotic Cell", "Cell Membrane", "Cell Wall", "Endoplasmic Reticulum", "Golgi Apparatus", "Lysosome", "Vacuole", "Mitochondria", "Plastids", "Ribosomes", "Cilia and Flagella", "Cytoskeleton", "Nucleus", "Chromosomes"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U8", chapter: "Cell: The Unit of Life", chapterOrder: 8, topic, topicOrder: i + 1 })),

  // U9 – Biomolecules (Bio XI)
  ...["Primary and Secondary Metabolites", "Carbohydrates", "Lipids", "Proteins", "Nucleic Acids", "Enzymes", "Factors Affecting Enzyme Activity", "Cofactors"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U9", chapter: "Biomolecules", chapterOrder: 9, topic, topicOrder: i + 1 })),

  // U10 – Cell Cycle and Cell Division
  ...["Cell Cycle", "Mitosis", "Significance of Mitosis", "Meiosis"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U10", chapter: "Cell Cycle and Cell Division", chapterOrder: 10, topic, topicOrder: i + 1 })),

  // U11 – Photosynthesis in Higher Plants
  ...["Early Experiments", "Photosynthetic Pigments", "Light Reaction", "Photophosphorylation", "Calvin Cycle (C3)", "C4 Pathway", "Photorespiration", "Factors Affecting Photosynthesis"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U11", chapter: "Photosynthesis in Higher Plants", chapterOrder: 11, topic, topicOrder: i + 1 })),

  // U12 – Respiration in Plants
  ...["Glycolysis", "Fermentation (Anaerobic Respiration)", "Krebs Cycle", "Electron Transport System", "Amphibolic Pathway", "Respiratory Quotient"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U12", chapter: "Respiration in Plants", chapterOrder: 12, topic, topicOrder: i + 1 })),

  // U13 – Plant Growth and Development
  ...["Growth", "Differentiation Dedifferentiation and Redifferentiation", "Development", "Plant Growth Regulators", "Auxins", "Gibberellins", "Cytokinins", "Ethylene", "ABA"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U13", chapter: "Plant Growth and Development", chapterOrder: 13, topic, topicOrder: i + 1 })),

  // U14 – Breathing and Exchange of Gases
  ...["Respiratory Organs", "Human Respiratory System", "Mechanism of Breathing", "Respiratory Volumes and Capacities", "Exchange of Gases", "Transport of Gases", "Respiratory Disorders"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U14", chapter: "Breathing and Exchange of Gases", chapterOrder: 14, topic, topicOrder: i + 1 })),

  // U15 – Body Fluids and Circulation
  ...["Blood", "Blood Groups", "Heart Structure", "Cardiac Cycle", "ECG and Blood Pressure", "Double Circulation", "Blood Vessels", "Regulation of Cardiac Activity"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U15", chapter: "Body Fluids and Circulation", chapterOrder: 15, topic, topicOrder: i + 1 })),

  // U16 – Excretory Products and Their Elimination
  ...["Excretory Wastes", "Excretory Organs", "Human Excretory System", "Nephron Function", "Urine Concentration", "Regulation of Kidney Function", "Disorders"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U16", chapter: "Excretory Products and Their Elimination", chapterOrder: 16, topic, topicOrder: i + 1 })),

  // U17 – Locomotion and Movement
  ...["Types of Movement", "Skeleton", "Joints", "Muscles", "Disorders"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U17", chapter: "Locomotion and Movement", chapterOrder: 17, topic, topicOrder: i + 1 })),

  // U18 – Neural Control and Coordination
  ...["Neuron and Nerve Impulse", "Impulse Transmission", "Central Nervous System", "Reflex Action and Sense Organs"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U18", chapter: "Neural Control and Coordination", chapterOrder: 18, topic, topicOrder: i + 1 })),

  // U19 – Chemical Coordination and Integration
  ...["Endocrine Glands", "Pituitary", "Thyroid", "Parathyroid", "Adrenal", "Pancreas", "Testis", "Ovary", "Other Hormones", "Mechanism of Hormone Action"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XI", unitCode: "U19", chapter: "Chemical Coordination and Integration", chapterOrder: 19, topic, topicOrder: i + 1 })),

  // ══════════════════════════════════════════════════════════════════
  // BIOLOGY — CLASS XII
  // ══════════════════════════════════════════════════════════════════

  // U1 – Sexual Reproduction in Flowering Plants
  ...["Microsporogenesis and Pollen", "Megasporogenesis and Embryo Sac", "Pollination", "Outbreeding Devices", "Pollen-Pistil Interaction", "Double Fertilization", "Endosperm", "Embryo", "Seed and Fruit", "Apomixis and Polyembryony"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U1", chapter: "Sexual Reproduction in Flowering Plants", chapterOrder: 1, topic, topicOrder: i + 1 })),

  // U2 – Human Reproduction
  ...["Male Reproductive System", "Female Reproductive System", "Gametogenesis", "Menstrual Cycle", "Fertilization and Implantation", "Pregnancy and Embryonic Development", "Parturition and Lactation"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U2", chapter: "Human Reproduction", chapterOrder: 2, topic, topicOrder: i + 1 })),

  // U3 – Reproductive Health
  ...["Reproductive Health", "Birth Control", "MTP", "STDs", "Infertility"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U3", chapter: "Reproductive Health", chapterOrder: 3, topic, topicOrder: i + 1 })),

  // U4 – Principles of Inheritance and Variation
  ...["Mendelism", "Monohybrid Cross", "Incomplete Dominance", "Codominance and Multiple Alleles", "Dihybrid Cross", "Chromosomal Theory", "Linkage and Recombination", "Polygenic Inheritance", "Pleiotropy", "Sex Determination", "Mutation", "Pedigree Analysis", "Chromosomal Disorders"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U4", chapter: "Principles of Inheritance and Variation", chapterOrder: 4, topic, topicOrder: i + 1 })),

  // U5 – Molecular Basis of Inheritance
  ...["DNA", "Search for Genetic Material", "Replication", "Transcription", "Genetic Code", "Translation", "Gene Regulation", "Human Genome Project", "DNA Fingerprinting"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U5", chapter: "Molecular Basis of Inheritance", chapterOrder: 5, topic, topicOrder: i + 1 })),

  // U6 – Evolution
  ...["Origin of Life", "Evidence", "Adaptive Radiation", "Mechanism", "Hardy-Weinberg Principle", "Human Evolution"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U6", chapter: "Evolution", chapterOrder: 6, topic, topicOrder: i + 1 })),

  // U7 – Human Health and Disease
  ...["Bacterial Diseases", "Protozoan Diseases", "Helminth Diseases", "Immunity", "AIDS", "Cancer", "Drugs and Alcohol Abuse"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U7", chapter: "Human Health and Disease", chapterOrder: 7, topic, topicOrder: i + 1 })),

  // U8 – Microbes in Human Welfare
  ...["Household Products", "Industrial Products", "Sewage Treatment", "Biogas", "Biocontrol", "Biofertilizers"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U8", chapter: "Microbes in Human Welfare", chapterOrder: 8, topic, topicOrder: i + 1 })),

  // U9 – Biotechnology: Principles and Processes
  ...["Principles", "Tools of rDNA Technology", "Restriction Enzymes", "Cloning Vectors", "PCR", "Transformation", "rDNA Process"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U9", chapter: "Biotechnology Principles and Processes", chapterOrder: 9, topic, topicOrder: i + 1 })),

  // U10 – Biotechnology and Its Applications
  ...["Agriculture", "Tissue Culture", "Medicine", "Transgenic Animals", "Ethical Issues"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U10", chapter: "Biotechnology and Its Applications", chapterOrder: 10, topic, topicOrder: i + 1 })),

  // U11 – Organisms and Populations
  ...["Ecology", "Abiotic and Biotic Factors", "Population Attributes", "Population Growth", "Population Interactions"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U11", chapter: "Organisms and Populations", chapterOrder: 11, topic, topicOrder: i + 1 })),

  // U12 – Ecosystem
  ...["Structure and Function", "Productivity", "Decomposition", "Energy Flow", "Ecological Pyramids"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U12", chapter: "Ecosystem", chapterOrder: 12, topic, topicOrder: i + 1 })),

  // U13 – Biodiversity and Conservation
  ...["Introduction", "Biodiversity in India", "Patterns", "Loss", "Causes", "Conservation"]
    .map((topic, i) => ({ subject: "biology", classLevel: "XII", unitCode: "U13", chapter: "Biodiversity and Conservation", chapterOrder: 13, topic, topicOrder: i + 1 })),
];

// ─── Seed Function ────────────────────────────────────────────────────────────

async function seedSyllabus() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("[DB] Connected to platform DB.");

    let inserted = 0;
    let skipped  = 0;

    for (const entry of SYLLABUS) {
      const result = await SyllabusConfig.updateOne(
        {
          subject:    entry.subject,
          classLevel: entry.classLevel,
          chapter:    entry.chapter,
          topic:      entry.topic,
        },
        {
          $setOnInsert: { weight: 1.0, isActive: true },
          $set: {
            unitCode:     entry.unitCode,
            chapterOrder: entry.chapterOrder,
            topicOrder:   entry.topicOrder,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) inserted++;
      else skipped++;
    }

    console.log(`\n✅ Syllabus seeding complete.`);
    console.log(`   Total topics in data:  ${SYLLABUS.length}`);
    console.log(`   Newly inserted:        ${inserted}`);
    console.log(`   Already existed:       ${skipped}`);

    // Summary per subject
    const stats = await SyllabusConfig.aggregate([
      { $group: { _id: { subject: "$subject", classLevel: "$classLevel" }, count: { $sum: 1 } } },
      { $sort: { "_id.subject": 1, "_id.classLevel": 1 } },
    ]);
    console.log("\n📊 Topics per subject × class:");
    for (const s of stats) {
      console.log(`   ${s._id.subject.padEnd(12)} ${s._id.classLevel.padEnd(8)} → ${s.count} topics`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("[Seed] Error:", err.message);
    process.exit(1);
  }
}

seedSyllabus();
