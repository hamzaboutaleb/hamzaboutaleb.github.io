const languageNames = {
  js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
  jsx: 'JSX', tsx: 'TSX', html: 'HTML', css: 'CSS', json: 'JSON',
  sh: 'Shell', bash: 'Bash', shell: 'Shell', python: 'Python', py: 'Python',
  php: 'PHP', sql: 'SQL', c: 'C', cpp: 'C++', rust: 'Rust', go: 'Go',
  md: 'Markdown', markdown: 'Markdown', yaml: 'YAML', yml: 'YAML',
  text: 'Text', plaintext: 'Text', txt: 'Text',
};

const element = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
const text = value => ({ type: 'text', value });

export function codeBlocks() {
  return tree => {
    function walk(parent) {
      if (!Array.isArray(parent.children)) return;
      parent.children = parent.children.map(node => {
        if (node.type !== 'element' || node.tagName !== 'pre') {
          walk(node);
          return node;
        }
        const code = node.children?.find(child => child.tagName === 'code');
        if (!code) return node;
        const classes = code.properties?.className ?? [];
        const language = node.properties?.['data-language'] ?? node.properties?.dataLanguage
          ?? classes.find?.(name => name.startsWith('language-'))?.slice(9) ?? 'text';
        const label = languageNames[language] ?? language;
        return element('figure', { className: ['code-block'] }, [
          element('figcaption', { className: ['code-toolbar'] }, [
            element('span', { className: ['code-language'] }, [text(label)]),
            element('span', { className: ['code-actions'] }, [
              element('span', { className: ['code-feedback'], role: 'status' }, []),
              element('button', { type: 'button', className: ['copy-code'], hidden: true, ariaLabel: `Copy ${label} code` }, [text('Copy')]),
            ]),
          ]),
          node,
        ]);
      });
    }
    walk(tree);
  };
}
