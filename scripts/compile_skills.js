import fs from 'fs';
import path from 'path';

const skillsBaseDir = 'C:\\Users\\dell\\.gemini\\config\\skills';
const outFile = path.resolve('c:/Users/dell/simulador/SKILLS.md');

const categories = [
  {
    category: 'Economía Dual, Finanzas y Fiscalidad (Alcalde & Magnate)',
    description: 'Modelos macro y microeconómicos, balance presupuestario, cálculo de consumo fiscal de obras públicas y rentabilidad corporativa.',
    skills: [
      'city-builder-economy',
      'public-private-tycoon-economist-pro',
      'public-works-fiscal-feasibility-advisor'
    ]
  },
  {
    category: 'Arquitectura de Juego, Sistemas y Simulación Urbana',
    description: 'Arquitectura técnica modular, ciclo de simulación a 60 FPS, sistemas de demografía, alcaldía y ergonomía de juego.',
    skills: [
      'city-builder-architect',
      'city-builder-ui-architect'
    ]
  },
  {
    category: 'Arte 2.5D, Pixel Art, Cinemática, Físicas y Biomas',
    description: 'Generación procedural de mundos 2.5D, footprints elípticos, animación de esqueletos/locomoción y dirección de arte.',
    skills: [
      'procedural-pixel-25d-architect',
      'pixel-25d-ambient-asset-specialist',
      'pixel-25d-collision-physics-specialist',
      'pixel-25d-kinematics-animator',
      'pixel-25d-master-animator',
      'pixel-25d-ai-behavior-director',
      'virtual-biome-lead',
      'multimedia-art-director'
    ]
  },
  {
    category: 'Ingeniería de UI/UX, Optimización Web y Verificación de Sistemas',
    description: 'Diseño de interfaces táctiles, ergonomía móvil, Core Web Vitals, auditoría de rendimiento y verificación de código.',
    skills: [
      'ui-design-engine',
      'web-performance-ux',
      'system-verifier',
      'dev-consultant'
    ]
  },
  {
    category: 'Otros Proyectos del Ecosistema',
    description: 'Habilidades creadas para otros desarrollos dentro del ecosistema de simulación y juegos web.',
    skills: [
      'ramen-mania-designer'
    ]
  }
];

let doc = [];
doc.push('# Compendio Maestro de Skills - ISOMETRICA City Simulator\n');
doc.push('> **ISOMETRICA** es un simulador de ciudades y gestión económica dual desarrollado en HTML5 Canvas y Vanilla JS ES6+.');
doc.push('> Este documento unifica las **18 habilidades especializadas (Skills)** del proyecto, detallando la arquitectura de agentes, fórmulas económicas, cinemática 2.5D, directrices de arte y ergonomía de interfaz.\n');
doc.push('---\n');
doc.push('## 📑 Tabla de Contenidos\n');

for (const cat of categories) {
  doc.push(`### ${cat.category}`);
  doc.push(`*${cat.description}*\n`);
  for (const skName of cat.skills) {
    const skPath = path.join(skillsBaseDir, skName, 'SKILL.md');
    if (fs.existsSync(skPath)) {
      doc.push(`- [${skName}](#${skName.toLowerCase()})`);
    }
  }
  doc.push('');
}

doc.push('---\n');

for (const cat of categories) {
  doc.push(`# 🏛️ ${cat.category}\n`);
  doc.push(`> *${cat.description}*\n`);
  
  for (const skName of cat.skills) {
    const skPath = path.join(skillsBaseDir, skName, 'SKILL.md');
    if (fs.existsSync(skPath)) {
      const raw = fs.readFileSync(skPath, 'utf-8');
      
      // Separar frontmatter YAML si existe
      let frontmatter = '';
      let body = raw;
      if (raw.startsWith('---')) {
        const parts = raw.split('---');
        if (parts.length >= 3) {
          frontmatter = parts[1].trim();
          body = parts.slice(2).join('---').trim();
        }
      }

      doc.push(`## 📌 ${skName}\n`);
      doc.push(`- **Identificador de Skill:** \`${skName}\``);
      doc.push(`- **Ruta del Archivo:** \`${skPath}\`\n`);
      
      if (frontmatter) {
        doc.push('```yaml');
        doc.push(frontmatter);
        doc.push('```\n');
      }

      // Renderizar el cuerpo directamente como Markdown
      doc.push(body);
      doc.push('\n---\n');
    }
  }
}

fs.writeFileSync(outFile, doc.join('\n'), 'utf-8');
console.log(`Archivo compilado exitosamente: ${outFile} (${fs.statSync(outFile).size} bytes)`);
