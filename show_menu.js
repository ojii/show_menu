Array.prototype.remove = function(item){
	this.splice(this.indexOf(item), 1);
	return this;
}

function getHash(defaults){
	if (!window.location.hash){
		return defaults;
	}
	var hash = window.location.hash;
	if (hash.substr(0, 1) == '#'){
		hash = hash.substr(1);
	}
	var obj = hash.parseQueryString();
	return Object.merge(defaults, obj);
}

function setHash(obj){
	window.location.hash = Object.toQueryString(obj);
}

function cutAfter(node, levels, finalnodes){
	if (levels != 0){
		node.children.each(function(child){
			cutAfter(child, levels - 1, finalnodes);
		});
		finalnodes.push(node);
	}
}

function cutLevels(nodes, fromlevel, tolevel, extra_inactive, extra_active){
	var selected = null;
	var finalnodes = [];
	nodes.each(function(node){
		if (node.level >= fromlevel && node.level <= tolevel){
			finalnodes.push(node);
		}
		if (!node.ancestor && (!node.selected) && (!node.descendant)){
			cutAfter(node, extra_inactive, finalnodes);
		}
		if (node.selected){
			selected = node;
		}
	});
	if (selected){
		cutAfter(selected, extra_active, finalnodes);
	}
	return finalnodes;
}

function _flatten(node){
	var nodes = [node];
	node.children.each(function(child){
		nodes.combine(_flatten(child, nodes));
	});
	return nodes;
}

function getFinalNodes(node, fromlevel, tolevel, extra_inactive, extra_active){
	var flatnodes = _flatten(node);
	return cutLevels(flatnodes, fromlevel, tolevel, extra_inactive, extra_active);
	
}

var Node = new Class({
	initialize: function(li, span, level, parent, descendant, selectedClass){
		this.li = li;
		this.span = span;
		this.children = [];
		this.parent = parent;
		this.ancestor = false;
		this.descendant = descendant;
		this.level = level;
		this.selectedClass = selectedClass;
		this.selected = this.checkSelected();
	},
	
	checkSelected: function(){
		var selected = false;
		if (this.span.hasClass(this.selectedClass)){
			selected = true;
			var node = this;
			while (node.parent){
				node.parent.ancestor = true;
				node = node.parent;
			}
		}
		return selected;
	},
	
	findChildren: function(){
		var childul = this.li.getChildren('ul');
		if (!childul.length){
			return;
		}
		childul[0].getChildren('li').each(function(childli){
			var childspan = childli.getChildren('span')[0];
			var childnode = new Node(childli, childspan, this.level + 1, this,
					this.descendant || this.selected, this.selectedClass);
			this.children.push(childnode);
			childnode.findChildren();
		}.bind(this));
	}
});

function buildMenu(rootul, selectedClass){
	var rootli = rootul.getChildren('li')[0];
	var rootspan = rootli.getChildren('span')[0];
	var rootnode = new Node(rootli, rootspan, 0, false, false, selectedClass);
	rootnode.findChildren();
	return rootnode;
}


var ShowMenu = new Class({
    Implements: [Options, Events],
    options: {},
    
    initialize: function(options){
        this.setOptions(options);
        this.sliders = {};
        this.fromlevel = 0;
        this.tolevel = 5;
        this.extra_active = 5;
        this.extra_inactive = 5;
    },
    activate: function(){
    	var fromhash = getHash({
    		selected: '0',
    		fromlevel: this.fromlevel,
    		tolevel: this.tolevel,
    		extra_active: this.extra_active,
    		extra_inactive: this.extra_inactive,
    	});
    	
    	this.fromlevel = fromhash.fromlevel;
    	this.tolevel = fromhash.tolevel;
    	this.extra_active = fromhash.extra_active;
    	this.extra_inactive = fromhash.extra_inactive;
    	
    	this.sliders.fromlevel = new Slider(this.options.fromlevel, this.options.fromlevel.getElement('.knob'), {
    	    range: [0, 5],
    	    initialStep: this.fromlevel,
    	    onChange: function(value){
    			this.fromlevel = value;
    			this.refreshDisplay();
	    	}.bind(this)
    	});
    	this.sliders.tolevel = new Slider(this.options.tolevel, this.options.tolevel.getElement('.knob'), {
    	    range: [0, 5],
    	    initialStep: this.tolevel,
    	    onChange: function(value){
    			this.tolevel = value;
    			this.refreshDisplay();
	    	}.bind(this)
    	});
    	this.sliders.extra_active = new Slider(this.options.extra_active, this.options.extra_active.getElement('.knob'), {
    	    range: [0, 5],
    	    initialStep: this.extra_active,
    	    onChange: function(value){
    			this.extra_active = value;
    			this.refreshDisplay();
	    	}.bind(this)
    	});
    	this.sliders.extra_inactive = new Slider(this.options.extra_inactive, this.options.extra_inactive.getElement('.knob'), {
    	    range: [0, 5],
    	    initialStep: this.extra_inactive,
    	    onChange: function(value){
    			this.extra_inactive = value;
    			this.refreshDisplay();
	    	}.bind(this)
    	});
    	
    	
    	this.options.tree.getElements('span').addEvent('click', function(event){
    		this.options.tree.getElement('.' + this.options.selected).removeClass(this.options.selected);
    		event.target.addClass(this.options.selected);
    		this.refreshDisplay();
    	}.bind(this));
    	
    	var selected = this.options.tree.getElements('span')[fromhash.selected];
    	selected.fireEvent('click', {'target': selected});
    },
    
    refreshDisplay: function(){
    	var qsobj = {
    		'selected': this.options.tree.getElements('span').indexOf(this.options.tree.getElement('.' + this.options.selected)),
    		'fromlevel': this.fromlevel,
    		'tolevel': this.tolevel,
    		'extra_active': this.extra_active,
    		'extra_inactive': this.extra_inactive
    	};
    	setHash(qsobj);
    	this.options.display.set('text', '{% show_menu {fromlevel} {tolevel} {extra_inactive} {extra_active} %}'.substitute(this));
    	this.rebuildMenu();
    },
    
    rebuildMenu: function(){
    	var root = buildMenu(this.options.tree, this.options.selected);
    	var finalnodes = getFinalNodes(root, this.fromlevel, this.tolevel, this.extra_inactive, this.extra_active);
    	var active_lis = finalnodes.map(function(node){return node.li;});
    	function _recurse(node){
    		if (active_lis.indexOf(node) != -1){
    			node.removeClass('hidden').getChildren('span').removeClass('hidden');
    		} else {
    			node.addClass('hidden').getChildren('span').addClass('hidden');
    		}
    		node.getChildren('ul').each(function(ul){
    			ul.getChildren('li').each(function(li){
    				_recurse(li);
    			})
    		})
    	}
    	this.options.tree.getChildren('li').each(function(item){
    		_recurse(item);
    	});
    }
});