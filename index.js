import escapeStringRegexp from "escape-string-regexp";
import isObject from "is-object";
import isRegExp from "is-regexp";
import isString from "is-string";



const DEFAULT_OPTIONS =
{
	acceptAttribute: () => true,
	acceptNode: () => NodeFilter.FILTER_ACCEPT,
	attributes: true,
	characterData: true,
	subtree: true
};



const ignoredNodeTypes =
[
	Node.ATTRIBUTE_NODE,
	Node.CDATA_SECTION_NODE, // @todo maybe support this?
	Node.COMMENT_NODE, // @todo maybe support this
	Node.DOCUMENT_TYPE_NODE,
	Node.ENTITY_NODE,
	Node.ENTITY_REFERENCE_NODE,
	Node.NOTATION_NODE,
	Node.PROCESSING_INSTRUCTION_NODE
];



const walk = (node, options, callback) =>
{
	let walkChildNodes = false;

	if (node.nodeType===Node.DOCUMENT_NODE || node.nodeType===Node.DOCUMENT_FRAGMENT_NODE)
	{
		walkChildNodes = true;
	}
	else if (!ignoredNodeTypes.includes(node.nodeType))
	{
		const nodeFilter = options.acceptNode(node);

		if (options.attributes && node.hasAttributes() && nodeFilter===NodeFilter.FILTER_ACCEPT)
		{
			callback(node);
		}

		if ((options.subtree || options.characterData) && node.hasChildNodes() && nodeFilter!==NodeFilter.FILTER_REJECT)
		{
			walkChildNodes = true;
		}
	}

	if (walkChildNodes)
	{
		node.childNodes.forEach(child =>
		{
			if (options.subtree && child.nodeType===Node.ELEMENT_NODE)
			{
				walk(child, options, callback);
			}
			else if (options.characterData && child.nodeType===Node.TEXT_NODE && options.acceptNode(child)===NodeFilter.FILTER_ACCEPT)
			{
				callback(child);
			}
		});
	}
};



export default (needles, replacements, target, options=DEFAULT_OPTIONS) =>
{
	if (isRegExp(needles) || isString(needles))
	{
		needles = [needles];
	}
	else if (!Array.isArray(needles))
	{
		throw new TypeError("Needle must be a string, RegExp or Array of such");
	}

	if (isString(replacements))
	{
		replacements = [replacements];
	}
	else if (!Array.isArray(replacements))
	{
		throw new TypeError("Replacement must be a string or Array of such");
	}

	if (needles.length !== replacements.length)
	{
		throw new TypeError("There must be an equal number of needles and replacements");
	}
	else if (!(target instanceof Node))
	{
		throw new TypeError("Target must be a Node");
	}
	else if (!isObject(options))
	{
		throw new TypeError("Options must be an object");
	}
	else if (options !== DEFAULT_OPTIONS)
	{
		options = { ...DEFAULT_OPTIONS, ...options };
	}

	if (!options.attributes && !options.characterData)
	{
		throw new TypeError("Options must have at least 'attributes' or 'characterData' set to true");
	}

	needles = needles.map(n => isString(n) ? new RegExp(escapeStringRegexp(n), "g") : n);

	walk(target, options, node =>
	{
		if (node.nodeType === Node.ELEMENT_NODE)
		{
			Array.from(node.attributes).forEach(attribute =>
			{
				if (options.acceptAttribute(attribute))
				{
					needles.forEach((needle, i) =>
					{
						attribute.value = attribute.value.replace(needle, replacements[i]);
					});
				}
			});
		}
		else if (node.nodeType === Node.TEXT_NODE)
		{
			needles.forEach((needle, i) =>
			{
				node.nodeValue = node.nodeValue.replace(needle, replacements[i]);
			});
		}
	});
};
