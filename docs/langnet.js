/**
 * (c) Cotrino, 2012 (http://www.cotrino.com/)
 * 
 */

var w = 0, h = 0;
var chart = "network";
var networkChart = {
		vis : null,
		nodes : [],
		labelAnchors : [],
		labelAnchorLinks : [],
		links : [],
		force : null,
		force2 : null
};
var chordChart = {
		links : [], // Square matrix
		data : []
};
var hideUnrelated = false;
var similarityThresholdMin = 5;
var similarityThresholdMax = 0;
var similarityThreshold = 5;

var grpThresholdMin = 1;
var grpThresholdMax = 0;
var grpThreshold = 1;


function restart() {

	if( d3.select("#graph") != null ) {
		d3.select("#graph").remove();
	}
	w = $('#graphHolder').width();
	h = $('#graphHolder').height();

	$('#similarity').html(Math.round(similarityThreshold)+"%");
	$('#grp').html(Math.round(grpThreshold));

	// clear network, if available
	if( networkChart.force != null ) {	networkChart.force.stop();	}
	if( networkChart.force2 != null ) {	networkChart.force2.stop();	}
	networkChart.nodes = [];
	networkChart.labelAnchors = [];
	networkChart.labelAnchorLinks = [];
	networkChart.links = [];

	// clear chord, if available
	chordChart.links = [];
	chordChart.data = [];

	if( chart == "network" ) {
		drawNetwork();
	} else if( chart == "chord" ) {
		drawChord();
	}
}

function about() {
    $("#about" ).dialog( "open" );
    return false;
}

function drawNetwork() {

	buildNetwork();

	$("#hint").html("鼠标悬停或拖动任一用户，可查其相似用户及相似度；鼠标点击任一用户，可查看其群组详情。<br><br>圆大小正比于用户活跃度，线宽正比于两用户间相似度。");

	networkChart.vis = d3.select("#graphHolder").append("svg:svg").attr("id", "graph").attr("width", w).attr("height", h);

	networkChart.force = d3.layout.force().size([w, h])
	.nodes(networkChart.nodes).links(networkChart.links)
	.gravity(1).linkDistance(100).charge(-3000)//gravity引力 linkDistance线长 charge斥力
	.linkStrength(function(x) {
		return x.weight * 10 //调整引力强度：正比于相似度
	});
	networkChart.force.start();

	// brings everything towards the center of the screen
	networkChart.force2 = d3.layout.force()
	.nodes(networkChart.labelAnchors).links(networkChart.labelAnchorLinks)
	.gravity(0).linkDistance(0).linkStrength(8).charge(-100).size([w, h]);
	networkChart.force2.start();

	var link = networkChart.vis.selectAll("line.link")
	.data(networkChart.links).enter()
	.append("svg:line").attr("class", "link")
	.style("stroke", function(d, i) { return d.color })
	.style("stroke-width",  function(d, i) { return 1 + 2.5 * (d.weight -similarityThreshold/100)/(1-similarityThreshold/100)});//线宽正比于相似度

	var myTool = d3.select("body")
	.append("div")
	.attr("class", "mytooltip")
	.style("opacity", "0")
	.style("display", "none")
	.on("mouseover", function(d){  //Mouse event;
		myTool
		.transition()  //Opacity transition when the tooltip appears
		.duration(500)
		.style("opacity", "1")                           
		.style("display", "block")

	  })
	  .on("mouseout", function(d){
		myTool
		.transition()  //Opacity transition when the tooltip disappears
		.duration(5000)
		.style("opacity", "0")            
		.style("display", "none")  //The tooltip disappears
	  });

	var node = networkChart.vis.selectAll("g.node")
	.data(networkChart.force.nodes()).enter()
	.append("svg:g").attr("id", function(d, i) { return d.label }).attr("class", "node");
	node.append("svg:circle").attr("id",function(d, i) { return "c_"+d.label })
	.attr("r", function(d, i) { return d.size })
	.style("fill", function(d, i) { return d.color })
	.style("stroke", "#FFF").style("stroke-width", 2)
	.on("mouseover", function(d) {
		d3.select(this).transition().duration(200).style("cursor", "pointer").attr("r", function(d, i) { return d.size*1.5 });
	})
	.on("mouseout", function(d) {
		d3.select(this).transition().duration(200).style("cursor", "normal").attr("r", function(d, i) { return d.size });
	})
	.on("click",function(d){
		myTool
		.transition()  //Opacity transition when the tooltip appears
		.duration(500)
		.style("opacity", "1")                           
		.style("display", "block")
		myTool
		.html('<span>' + d.label +'所属群组行为序列（时间粒度1小时）</span>'+'<svg>'+grpDots(d.id)+'</svg>')
		//.html('<span>' + d.label + getGroup(d.id) + '</span>'+'<svg ><g><circle class="svg2" cx="10" cy="10" r="1"></circle></g><g><circle class="svg2" cx="13" cy="10" r="1"></circle></g></svg>')
		.style("left", (d3.event.pageX - 113) + "px")   
		.style("top", (d3.event.pageY -60) + "px");  //The tooltip appears
	});
	
	node.call(networkChart.force.drag);
	node.on("mouseover", function(d) {
		showInformation(d.id);
	});

	var anchorLink = networkChart.vis.selectAll("line.anchorLink")
	.data(networkChart.labelAnchorLinks);

	var anchorNode = networkChart.vis.selectAll("g.anchorNode")
	.data(networkChart.force2.nodes()).enter()
	.append("svg:g").attr("class", "anchorNode");
	anchorNode.append("svg:circle")
	.attr("id",function(d, i) { return "ct_"+d.node.label })
	.attr("r", 0).style("fill", "#FFF");
	anchorNode.append("svg:text")
	.attr("id",function(d, i) { return "t_"+d.node.label })
	.text(function(d, i) {
		return i % 2 == 0 ? "" : d.node.label
	}).style("fill", function(d, i) { return d.node.textcolor })
	.style("font-family", "Arial")
	.style("font-size", 10)
	.on("mouseover", function(d) {
		showInformation(d.node.id);
	});

	var updateLink = function() {
		this.attr("x1", function(d) {
			return d.source.x;
		}).attr("y1", function(d) {
			return d.source.y;
		}).attr("x2", function(d) {
			return d.target.x;
		}).attr("y2", function(d) {
			return d.target.y;
		});

	}

	var updateNode = function() {
		this.attr("transform", function(d) {
			return "translate(" + d.x + "," + d.y + ")";
		});

	}

	networkChart.force.on("tick", function() {
		networkChart.force2.start();
		node.call(updateNode);
		anchorNode.each(function(d, i) {
			if(i % 2 == 0) {
				d.x = d.node.x;
				d.y = d.node.y;
			} else {
				var b = this.childNodes[1].getBBox();
				var diffX = d.x - d.node.x;
				var diffY = d.y - d.node.y;
				var dist = Math.sqrt(diffX * diffX + diffY * diffY);
				var shiftX = b.width * (diffX - dist) / (dist * 2);
				shiftX = Math.max(-b.width, Math.min(0, shiftX));
				var shiftY = 5;
				this.childNodes[1].setAttribute("transform", "translate(" + shiftX + "," + shiftY + ")");
			}
		});
		anchorNode.call(updateNode);
		link.call(updateLink);
		anchorLink.call(updateLink);
	});

}

function mincx(n){
	var minx = nodesArray[0].time[0];
	var tmp=getGroup(n);
	for(k=0;k<tmp.length;k++){
		var ttmp=tmp[k];
	  	for(l=0;l<nodesArray[ttmp].time.length;l++){
			if(minx>nodesArray[ttmp].time[l]){
		  	minx=nodesArray[ttmp].time[l];
			}
	  	}
	}
	return minx
}


function grpDots(n){
	var dots='';
	var tmp=getGroup(n);
  	for(i=0;i<tmp.length;i++){
		var ttmp = tmp[i];
    	for(m=0;m<nodesArray[ttmp].time.length;m++){
      		dots=dots+'<g><text x="100" y="'+15*(i+1)+'" fill="#424858" font-family=" Georgia, serif" font-size="8pt" style="text-anchor: end">'+nodesArray[ttmp].label+':</text><circle fill="#262F52" cx="'+ (nodesArray[ttmp].time[m]-mincx(n)+26)*4 +'" cy="'+15*(i+1)+'" r="1"></circle></g>';
    	}
  	}
  	return dots;
}

function buildNetwork() {

	var newMapping = [];
	var k = 0;
	for(var i=0; i<nodesArray.length; i++) {
		var node = nodesArray[i];
		var draw = true;
		if( hideUnrelated ) {
			if( getAmountLinks(i) == 0 ) {
				draw = false;
			}
		}
		var grp = getGroup(i);
		//adjustSlider2(grp.length);
		if(grp.length<grpThreshold){
			draw = false;
		}
		if( draw ) {
			newMapping[i] = k;
			networkChart.nodes.push(node);
			networkChart.labelAnchors.push({ node : node });
			networkChart.labelAnchors.push({ node : node });
			k++;
			adjustSlider2(grp.length);
		} else {
			newMapping[i] = -1;
		}
	}

	for(var j=0; j<linksArray.length; j++) {
		var link = linksArray[j];
		var sim = link.weight;
		adjustSlider(sim);

		// just draw the links if similarity is higher than the threshold
		// or the nodes exist
		if( sim >= similarityThreshold/100.0 && newMapping[link.source] != -1 && newMapping[link.target] != -1 ) {
			var newLink = { source : newMapping[link.source], target : newMapping[link.target], weight : sim, color : link.color };
			networkChart.links.push(newLink);
		}
	}

	// link labels to circles
	for(var i = 0; i < networkChart.nodes.length; i++) {
		networkChart.labelAnchorLinks.push({ source : i * 2, target : i * 2 + 1, weight : 1 });
	}
}

//adjust the scala of the slider
function adjustSlider(sim) {
	if( sim*100 > similarityThresholdMax ) {
		similarityThresholdMax = sim*100; 
	} else if( sim*100 < similarityThresholdMin ) {
		similarityThresholdMin = sim*100;
	}
}
function adjustSlider2(grp) {
	if( grp > grpThresholdMax ) {
		grpThresholdMax = grp; 
	} else if( grp < grpThresholdMin ) {
		grpThresholdMin = grp;
	}
}

function buildChord() {

	var newMapping = [];
	var k = 0;
	for(var i=0; i<nodesArray.length; i++) {
		var node = nodesArray[i];
		var draw = true;
		if( hideUnrelated ) {
			if( getAmountLinks(i) == 0 ) {
				draw = false;
			}
		}
		if( draw ) {
			newMapping[i] = k;
			k++;
		} else {
			newMapping[i] = -1;
		}
	}
	
	for(var i=0; i<linksArray.length; i++) {
		var link = linksArray[i];
		var lang1 = nodesArray[link.source];
		var lang2 = nodesArray[link.target];
		var sim = link.weight;
		adjustSlider(sim);

		// just draw the links if similarity is higher than the threshold
		// or the nodes exist
		if( sim >= similarityThreshold/100.0 ) { //&& newMapping[link.source] != -1 && newMapping[link.target] != -1 ) {
			chordChart.data.push({
				source: lang1, 
				target: lang2,
				size: lang1.size, 
				similarity: sim,
				color: link.color
			});
		}
	}
	chordChart.data.forEach(function(d) {
		d.source.similarity = d.similarity;
		d.target.similarity = d.similarity;
		d.valueOf = value; // convert object to number implicitly
	});
	// Initialize link matrix
	for (var i = 0; i < nodesArray.length; i++) {
		chordChart.links[i] = [];
		for (var j = 0; j < nodesArray.length; j++) {
			chordChart.links[i][j] = 0;
		}
	}
	// Populate the link matrix with actual values
	chordChart.data.forEach(function(d) {
		chordChart.links[d.source.id][d.target.id] = d;
	});

	function value() {
		return +this.size;
	}
}

function drawChord() {

	buildChord();

	$("#hint").html("鼠标悬浮在任一用户上可查看其相关用户及相似性。");

	// Chart dimensions.
	var r1 = Math.min(w, h) / 2 - 4;
	var r0 = r1 - 100;

	// The chord layout, for computing the angles of chords and groups.
	var layout = d3.layout.chord()
	//.sortGroups(d3.descending)
	.sortSubgroups(d3.descending)
	.padding(.04)
	.matrix(chordChart.links);

	// The arc generator for the groups
	var arc = d3.svg.arc().innerRadius(r0).outerRadius(r1);

	// The chord generator (quadratic Bézier) for the chords
	var chord = d3.svg.chord().radius(r0);

	// Add an SVG element
	var svg = d3.select("#graphHolder")
	.append("svg").attr("id", "graph")
	.attr("width", w)
	.attr("height", h)
	.append("g")
	.attr("transform", "translate(" + (100+w/2) + "," + h/2 + ")");

	// Add chords
	svg.selectAll("path")
	.data(layout.chords)
	.enter().append("path")
	.attr("class", "chord")
	.style("fill", function(d) { return d.source.value.color; })
	.style("stroke", function(d) { return d.source.value.color; })
	.attr("d", chord);

	// Add groups
	var g = svg.selectAll("g.group")
	.data(layout.groups)
	.enter().append("g")
	.attr("class", "group");

	// Add the group arc
	g.append("path")
	.on("mouseover", fade(0))
	.on("mouseout", fade(1))
	.style("fill", function(d) { return nodesArray[d.index].color; })
	.attr("id", function(d, i) { return "group" + d.index; })
	.attr("d", arc);

	// Add the language label
	g.append("svg:text")
	.attr("x", 6)
	.attr("dy", 15)
	.attr("transform", function(d) {
		return "rotate(" + (getMeanAgle(d) * 180 / Math.PI - 90) + ")"
		+ "translate("+r0+","+(-5-50*(d.endAngle-d.startAngle))+")";
	})
	.style("fill", function(d) { return d3.rgb(nodesArray[d.index].textcolor).darker(); })
	.style("font-size", function(d) { return 9+100*(d.endAngle-d.startAngle); })
	.text(function(d) { return nodesArray[d.index].label; });

	function getMeanAgle(d) {
		return d.startAngle+(d.endAngle-d.startAngle)/2;
	}

	/** Returns an event handler for fading a given chord group. */
	function fade(opacity) {
		return function(g, i) {
			showInformation(nodesArray[i].id);
			svg.selectAll("path.chord")
			.filter(function(d) {
				return d.source.index != i && d.target.index != i;
			})
			.transition()
			.style("opacity", opacity);
		};
	}
}

function hide() {
	if( $('#hide_checkbox').is(':checked') ) {
		hideUnrelated = true;
		restart();
	} else {
		hideUnrelated = false;
		restart();
	}
}

function filterChange(event, ui) {
	similarityThreshold = ui.value;
	restart();
}

function filterChange2(event, ui) {
	grpThreshold = ui.value;
	restart();
}

function chartChange(value) {
	chart = value;
	restart();
}

function getAmountLinks(n) { //这里获取在图上显示的一个点周围连接线的个数
	var linksAmount = 0;
	for(var j=0; j<linksArray.length; j++) {
		var link = linksArray[j];
		if( (link.source == n || link.target == n) && link.weight >= similarityThreshold/100.0 ) {
			linksAmount ++;
		}
	}
	return linksAmount;
}

function getGroup(n){
	var grp = [n];
	var pointer = 0;
	while(pointer != grp.length){	
		for(j=0;j<linksArray.length;j++){
			if(linksArray[j].source==grp[pointer]){
				if(grp.indexOf(linksArray[j].target )==-1 && linksArray[j].weight>= similarityThreshold/100){
					grp=grp.concat(linksArray[j].target);
				}	
			}
			if(linksArray[j].target==grp[pointer]){
				if(grp.indexOf(linksArray[j].source )==-1 && linksArray[j].weight>= similarityThreshold/100){
					grp=grp.concat(linksArray[j].source);
				}
			}
			
		}
		pointer=pointer+1;
	}
	return grp;
}


function showInformation(userid) {
//	var url = "http://10.8.2.243:3000/users/user_"+user+"/overview";
//	var n = nodesHash.user;
	$('#user_information').html(nodesArray[userid].desc);
}

function showGroup(userid) {
	$('#group_information').html(nodesArray[userid].size);
}