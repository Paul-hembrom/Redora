import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

const md = "This is a sentence.\nThat is another.";
const html = renderToStaticMarkup(createElement(ReactMarkdown, null, md));
console.log(JSON.stringify(html));
