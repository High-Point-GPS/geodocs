// Limits the page-wide rules in `?global` CSS (the PrimeReact theme: `:root` variables and
// font, `*` box-sizing, placeholder colours) to the time GeoDocs is on screen.
//
// MyGeotab keeps every add-in's CSS loaded for the whole page after the user moves on, but it
// removes the add-in's DOM. So `:has(#HPGPS)` is only true while GeoDocs is showing, and other
// add-ins never see these rules. `:where()` keeps each rule's original specificity.
// Class rules (.p-*, .geodocs-*) are left alone: only our components carry those classes.
const postcss = require('postcss');

const ON_PAGE = ':where(:has(#HPGPS))';
const IN_PAGE = ':where(body:has(#HPGPS))';

const scopeSelector = (selector) => {
	const s = selector.trim();
	if (/^(:root|html)(?![\w-])/.test(s)) return s.replace(/^(:root|html)/, `$1${ON_PAGE}`);
	if (/^body(?![\w-])/.test(s)) return s.replace(/^body/, `body${ON_PAGE}`);
	// Universal and bare pseudo selectors (`*`, `::placeholder`, `:-moz-placeholder`, ...)
	if (/^(\*|::?[\w-])/.test(s)) return `${IN_PAGE} ${s}`;
	return s;
};

module.exports = function (content) {
	const root = postcss.parse(content);
	root.walkRules((rule) => {
		if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
		rule.selectors = rule.selectors.map(scopeSelector);
	});
	return root.toString();
};
