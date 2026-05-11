const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../index.html');
const cssPath = path.join(__dirname, 'src/app/globals.css');
const pagePath = path.join(__dirname, 'src/app/page.tsx');

const htmlContent = fs.readFileSync(srcPath, 'utf8');

// Extract CSS
const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  const css = styleMatch[1];
  let globalsCss = fs.readFileSync(cssPath, 'utf8');
  globalsCss += `\n/* Migrated from index.html */\n${css}`;
  fs.writeFileSync(cssPath, globalsCss);
}

// Convert HTML body to React component
let bodyMatch = htmlContent.match(/<body>([\s\S]*?)<\/body>/);
if (bodyMatch) {
  let bodyContent = bodyMatch[1];
  
  // Basic JSX conversions
  bodyContent = bodyContent.replace(/class="/g, 'className="');
  bodyContent = bodyContent.replace(/for="/g, 'htmlFor="');
  bodyContent = bodyContent.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');
  bodyContent = bodyContent.replace(/style="([^"]*)"/g, (match, styleString) => {
    const styleObj = {};
    styleString.split(';').forEach(s => {
      if (s.trim()) {
        let [key, value] = s.split(':');
        key = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        styleObj[key] = value.trim();
      }
    });
    return `style={${JSON.stringify(styleObj)}}`;
  });
  
  // Close unclosed tags
  bodyContent = bodyContent.replace(/<img([^>]+[^\/])>/g, '<img$1 />');
  bodyContent = bodyContent.replace(/<br>/g, '<br />');
  bodyContent = bodyContent.replace(/<input([^>]+[^\/])>/g, '<input$1 />');
  
  // Remove scripts
  bodyContent = bodyContent.replace(/<script>[\s\S]*?<\/script>/g, '');

  const pageTsx = `
"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function Home() {
  return (
    <main>
      ${bodyContent}
    </main>
  );
}
`;
  fs.writeFileSync(pagePath, pageTsx);
  console.log("Migration completed");
}
