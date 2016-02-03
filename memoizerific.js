(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.memoizerific = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
if (typeof Map !== 'function' || (process && process.env && process.env.TEST_MAPORSIMILAR === 'true')) {
    module.exports = _dereq_('./similar');
}
else {
    module.exports = Map;
}
},{"./similar":2}],2:[function(_dereq_,module,exports){
function Similar() {
    this.list = [];
    this.lastItem = undefined;
    this.size = 0;

    return this;
}

Similar.prototype.get = function(key) {
    var index;

    if (this.lastItem && this.lastItem.key === key) {
        return this.lastItem.val;
    }

    index = this.indexOf(key);
    if (index >= 0) {
        this.lastItem = this.list[index];
        return this.list[index].val;
    }

    return undefined;
};

Similar.prototype.set = function(key, val) {
    var index;

    if (this.lastItem && this.lastItem.key === key) {
        this.lastItem.val = val;
        return this;
    }

    index = this.indexOf(key);
    if (index >= 0) {
        this.lastItem = this.list[index];
        this.list[index].val = val;
        return this;
    }

    this.lastItem = { key: key, val: val };
    this.list.push(this.lastItem);
    this.size++;

    return this;
};

Similar.prototype.delete = function(key) {
    var index;

    if (this.lastItem && this.lastItem.key === key) {
        this.lastItem = undefined;
    }

    index = this.indexOf(key);
    if (index >= 0) {
        this.size--;
        return this.list.splice(index, 1)[0];
    }

    return undefined;
};


// important that has() doesn't use get() in case an existing key has a falsy value, in which case has() would return false
Similar.prototype.has = function(key) {
    var index;

    if (this.lastItem && this.lastItem.key === key) {
        return true;
    }

    index = this.indexOf(key);
    if (index >= 0) {
        this.lastItem = this.list[index];
        return true;
    }

    return false;
};

Similar.prototype.indexOf = function(key) {
    var i;
    for (i = 0; i < this.size; i++) {
        if (this.list[i].key === key) {
            return i;
        }
    }
    return -1;
};

module.exports = Similar;
},{}],3:[function(_dereq_,module,exports){
var MapOrSimilar = _dereq_('map-or-similar');

module.exports = function (limit) {
    var cache = new MapOrSimilar(),
        lru = [];

    return function(fn) {
        var memoizerific = function () {
            var currentCache = cache,
                newMap,
                fnResult,
                argsLengthMinusOne = arguments.length - 1,
                lruPath = Array(argsLengthMinusOne + 1),
                isMemoized = true,
                i;

            // loop through each argument to traverse the map tree
            for (i = 0; i < argsLengthMinusOne; i++) {
                lruPath[i] = { cacheItem: currentCache, arg: arguments[i] };

        	    // if all arguments exist in map tree, the memoized result will be last value to be retrieved
        		if (currentCache.has(arguments[i])) {
        			currentCache = currentCache.get(arguments[i]);
        			continue;
        		}

    		    isMemoized = false;

    		    // make maps until last value
                newMap = new MapOrSimilar();
				currentCache.set(arguments[i], newMap);
				currentCache = newMap;
        	}

			// we are at the last arg, check if it is really memoized
			if (isMemoized) {
        		if (currentCache.has(arguments[argsLengthMinusOne])) {
        			fnResult = currentCache.get(arguments[argsLengthMinusOne]);
        		}
    			else {
    			    isMemoized = false;
    			}
			}

			if (!isMemoized) {
    			fnResult = fn.apply(null, arguments);
    			currentCache.set(arguments[argsLengthMinusOne], fnResult);
			}

			if (limit > 0) {
			    lruPath[argsLengthMinusOne] = { cacheItem: currentCache, arg: arguments[argsLengthMinusOne] };

                if (isMemoized) {
                    moveToMostRecentLru(lru, lruPath);
                }
                else {
				    lru.push(lruPath);
                }

                if (lru.length > limit) {
				    removeCachedResult(lru.shift());
				}
			}

			memoizerific.wasMemoized = isMemoized;

        	return fnResult;
        };

        memoizerific.limit = limit;
        memoizerific.wasMemoized = false;
        memoizerific.cache = cache;
        memoizerific.lru = lru;

        return memoizerific;
    };
};

// move current args to most recent position
function moveToMostRecentLru(lru, lruPath) {
    var lruLen = lru.length,
        lruPathLen = lruPath.length,
        isMatch,
        i, ii;

    for (i = 0; i < lruLen; i++) {
        isMatch = true;
	    for (ii = 0; ii < lruPathLen; ii++) {
	        if (lru[i][ii].arg !== lruPath[ii].arg) {
	            isMatch = false;
	            break;
	        }
	    }
	    if (isMatch) {
	        break;
	    }
    }

    lru.push(lru.splice(i, 1)[0]);
}

// remove least recently used cache item and all dead branches
function removeCachedResult(removedLru) {
    var removedLruLen = removedLru.length,
        currentLru = removedLru[removedLruLen - 1],
        tmp,
        i;

    currentLru.cacheItem.delete(currentLru.arg);

    // walk down the tree removing dead branches (size 0) along the way
    for (i = removedLruLen - 2; i >= 0; i--) {
        currentLru = removedLru[i];
        tmp = currentLru.cacheItem.get(currentLru.arg);

        if (!tmp || !tmp.size) {
            currentLru.cacheItem.delete(currentLru.arg);
        }
        else {
            break;
        }
    }
}
},{"map-or-similar":1}]},{},[3])(3)
});