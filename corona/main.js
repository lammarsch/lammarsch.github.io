var svg = null;
var projection = d3.geoMercator()
    .scale((1<<11) / (2 * Math.PI))
    .translate([0, 0]);
var path = d3.geoPath()
      .projection(projection);

var zoom = d3.zoom()
    .scaleExtent([1 << 11, 1 << 25])
    .on("zoom", zoomed);

var drawArcRecovered = d3.arc()
    .innerRadius(0)
    .outerRadius(arcRadius)
    .startAngle(0)
    .endAngle(function(d) {
        return d.recovered/d.confirmed * 2 * Math.PI;
    });
var drawArcIll = d3.arc()
    .innerRadius(0)
    .outerRadius(arcRadius)
    .startAngle(function(d) {
        return d.recovered/d.confirmed * 2 * Math.PI;
    })
    .endAngle(function(d) {
        return (d.ill+d.recovered)/d.confirmed * 2 * Math.PI;
    });
var drawArcDeaths = d3.arc()
    .innerRadius(0)
    .outerRadius(arcRadius)
    .startAngle(function(d) {
        return (d.ill+d.recovered)/d.confirmed * 2 * Math.PI;
    })
    .endAngle(function(d) {
        return 2 * Math.PI;
    });
function arcTranslate(d) {
    var coordinates = projection([d.lon,d.lat]);
    return "translate("+coordinates[0]+" "+coordinates[1]+")";
}
function arcRadius(d) {
    return Math.max(2,Math.sqrt(d.confirmed)/4*radiusFactor);
}

var byDate = {};
var byLocation = {}
var minDate = new Date(10000000000000);
var maxDate = new Date(0);
var maxConfirmed = {};
var dateFormatter = d3.timeFormat("%-m/%-d/%y");

var radiusFactor = 1;


var xScale = d3.scaleTime(); 
var yScale = d3.scaleLinear();
var xAxis = d3.axisBottom()
    .scale(xScale);
var yAxis = d3.axisLeft()
    .scale(yScale)
    .tickFormat(d3.format("2.2s"));
var area = d3.area()
.x(function(d) { 
    return xScale(d.data.date); })
  .y0(function(d) { return yScale(d[0]); })
  .y1(function(d) { return yScale(d[1]); });
var stack = d3.stack();


init();

function init() {
   var container = d3.select("div.mapContainer");
   svg = container.select("svg");
   if (svg.empty()) {
       svg = container.append("svg").attr("class","map");
    }

    var timelineContainer = d3.select("div.timelineContainer");
    svgTimeline = timelineContainer.select("svg");
    if (svgTimeline.empty()) {
        svgTimeline = timelineContainer.append("svg")
            .attr("class","timeline")  
            .on("mousemove",mousemoveTimeline)
            .on("mouseout",mouseoutTimeline);
   }

    queue()
        .defer(d3.json, "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
        .defer(d3.csv, "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv")
        .defer(d3.csv, "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Recovered.csv")
        .defer(d3.csv, "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Deaths.csv")
        .await(dataLoaded);

    window.addEventListener('resize', resizeRedraw);    	   		
}

function dataLoaded(error, map, confirmed, recovered, deaths) {
    svg.append("g")    
        .attr("class","backgroundLayer")
        .selectAll("path")
        .data(map.features)
        .enter().append("path")
            .attr("class", "country");
            
    confirmed.forEach(function(d) {
        Object.keys(d).forEach(function(d2) {
            if(d2.endsWith("/20")) {
                if (byDate[d2] == null)
                    byDate[d2] = {};
                var date = new Date(d2);
                var coord = d["Long"]+"/"+d["Lat"];
                var confirmed = parseInt(d[d2]);
                byDate[d2][coord] = {
                    coord: coord,
                    state: d["Province/State"],
                    region: d["Country/Region"],
                    lat: d["Lat"],
                    lon: d["Long"],
                    date: date,
                    confirmed: confirmed
                };
                if (date > maxDate)
                    maxDate = date;
                if (date < minDate)
                    minDate = date;
            }
        });
    });
    recovered.forEach(function(d) {
        Object.keys(d).forEach(function(d2) {
            if(d2.endsWith("/20")) {
                if (byDate[d2] == null)
                    byDate[d2] = {};
                var date = new Date(d2);
                var coord = d["Long"]+"/"+d["Lat"];
                if (byDate[d2][coord] == null)
                    byDate[d2][coord] = {
                        coord: coord,
                        state: d["Province/State"],
                        region: d["Country/Region"],
                        lat: d["Lat"],
                        lon: d["Long"],
                        date: date,
                        recovered: parseInt(d[d2])
                    };
                else
                    byDate[d2][coord].recovered = parseInt(d[d2]);
                if (date > maxDate)
                    maxDate = date;
                if (date < minDate)
                    minDate = date;

            }
        });
    });
    deaths.forEach(function(d) {
        Object.keys(d).forEach(function(d2) {
            if(d2.endsWith("/20")) {
                if (byDate[d2] == null)
                    byDate[d2] = {};
                var date = new Date(d2);
                var coord = d["Long"]+"/"+d["Lat"];
                if (byDate[d2][coord] == null)
                    byDate[d2][coord] = {
                        coord: coord,
                        state: d["Province/State"],
                        region: d["Country/Region"],
                        lat: d["Lat"],
                        lon: d["Long"],
                        date: date,
                        deaths: parseInt(d[d2])
                    };
                else
                    byDate[d2][coord].deaths = parseInt(d[d2]);
                var ill = byDate[d2][coord].confirmed - byDate[d2][coord].recovered - byDate[d2][coord].deaths;
                if (!isNaN(ill))
                    byDate[d2][coord].ill = ill;
                if (date > maxDate)
                    maxDate = date;
                if (date < minDate)
                    minDate = date;
            }
        });
    });

    byLocation.World = {};
    Object.keys(byDate).forEach(function(d) {
        Object.values(byDate[d]).forEach(function(d2) {
            if (byLocation[d2.coord] == null) {
                byLocation[d2.coord] = {};
                maxConfirmed[d2.coord] = 0;
            }
            byLocation[d2.coord][d] = d2;
            if (d2.confirmed > maxConfirmed[d2.coord])
                maxConfirmed[d2.coord] = d2.confirmed;
            if(byLocation.World[d] == null) {
                byLocation.World[d] = {
                    coord: d2.coord,
                    state: null,
                    region: "World",
                    lat: 49.7927,
                    lon: 9.9391,
                    date: d2.date,
                    recovered: d2.recovered,
                    ill: d2.ill,
                    deaths: d2.deaths
                };
            } else {
                byLocation.World[d].recovered += d2.recovered;
                byLocation.World[d].ill += d2.ill;
                byLocation.World[d].deaths += d2.deaths;
            }
        });
    });
    maxConfirmed.World = 0;
    Object.keys(maxConfirmed).forEach(function(d) {
        if (d != "World")
            maxConfirmed.World += maxConfirmed[d];
    });

    xScale.domain([minDate,maxDate]);
    yScale.domain([0,maxConfirmed.World]);

    var dataLayer = svg.append("g")
        .attr("class","dataLayer");
    dataLayer
        .selectAll("path.recovered")
        .data(Object.values(byDate[dateFormatter(maxDate)]))
        .enter().append("path")
            .attr("class","recovered")
            .on("mouseover",mouseoverMap)
            .on("mouseout",mouseoutMap);
    dataLayer
        .selectAll("path.ill")
        .data(Object.values(byDate[dateFormatter(maxDate)]))
        .enter().append("path")
            .attr("class","ill")
            .on("mouseover",mouseoverMap)
            .on("mouseout",mouseoutMap);
    dataLayer
        .selectAll("path.deaths")
        .data(Object.values(byDate[dateFormatter(maxDate)]))
        .enter().append("path")
            .attr("class","deaths")
            .on("mouseover",mouseoverMap)
            .on("mouseout",mouseoutMap);

    dataLayer
        .selectAll("text")
        .data(Object.values(byDate[dateFormatter(maxDate)]))
        .enter().append("text");

    svg.call(zoom);
    var center = projection([9.9391,49.7927]);
    var scale = 1 << 11;
    svg.call(zoom.transform, d3.zoomIdentity
            .translate(svg.node().clientWidth / 2, svg.node().clientHeight / 2)
            .translate(-center[0], -center[1])
            .scale(scale));


    
    xScale.range([0, svgTimeline.node().clientWidth-60]);
    yScale.range([svgTimeline.node().clientHeight-20,0]);
    
    stack.keys(["recovered","ill","deaths"]);

    stack.order(d3.stackOrderNone);
    stack.offset(d3.stackOffsetNone);
            
    var browser = svgTimeline.selectAll('.browser')
        .data(stack(Object.values(byLocation.World)))
    .enter().append('g')
        .attr('class', function(d){ return 'browser ' + d.key; });
          
    browser.append('path')
        .attr('class', 'area')
        .style('fill', function(d) { return "var(--color-"+d.key+")" })
        .attr('transform', 'translate(40,0)');
                  
    svgTimeline.append('g')
        .attr('class', 'xAxis');
          
    svgTimeline.append('g')
        .attr('class', 'yAxis');

    drawTimeline();
}

function mouseoverMap(d) {
    changeLocation(d.coord);
}

function mouseoutMap(d) {
    changeLocation("World");
}

function mousemoveTimeline() {
    var timeLineLine = svgTimeline.selectAll("line.position");
    if (timeLineLine.empty()) {
        timeLineLine = svgTimeline.append("line").attr("class","position")
    }
    timeLineLine    
        .attr("x1",d3.event.layerX)
        .attr("x2",d3.event.layerX)
        .attr("y1",0)
        .attr("y2",svgTimeline.node().clientHeight-20);

    selectTime(xScale.invert(d3.event.layerX-40));
}

function mouseoutTimeline(d) {
    svgTimeline.selectAll("line.position").remove();
    selectTime(maxDate);
}

function selectTime(date) {
    if(byDate[dateFormatter(date)] == null)
        date = maxDate;

    dataLayer = svg.selectAll("g.dataLayer");

    dataLayer.selectAll("path.recovered")
        .data(Object.values(byDate[dateFormatter(date)]));
    dataLayer.selectAll("path.ill")
        .data(Object.values(byDate[dateFormatter(date)]));
    dataLayer.selectAll("path.deaths")
        .data(Object.values(byDate[dateFormatter(date)]))

    dataLayer.selectAll("text")
        .data(Object.values(byDate[dateFormatter(date)]));

    drawMapData();
}

function changeLocation(coord) {
    svgTimeline.selectAll('.browser')
        .data(stack(Object.values(byLocation[coord])));
    yScale.domain([0,maxConfirmed[coord]]);

    drawTimeline();
}


function zoomed() {
    transform = d3.event.transform;
    projection
        .scale(transform.k / (2 * Math.PI))
        .translate([transform.x, transform.y]);

    radiusFactor = Math.max(1,Math.log2(transform.k)-11);

    drawMap();
    drawMapData();
}

function resizeRedraw() {
    drawTimeline();
}

function drawMap() {
    svg.select("g.backgroundLayer").selectAll("path")
        .attr("d", d3.geoPath().projection(projection));
}

function drawMapData() {
    svg.select("g.dataLayer").selectAll("path.recovered")        
        .attr("d",drawArcRecovered)
        .attr("transform",arcTranslate);
    svg.select("g.dataLayer").selectAll("path.ill")
        .attr("d",drawArcIll)
        .attr("transform",arcTranslate);
    svg.select("g.dataLayer").selectAll("path.deaths")
        .attr("d",drawArcDeaths)
        .attr("transform",arcTranslate);    
    
    svg.select("g.dataLayer").selectAll("text")
        .attr("transform",arcTranslate)
        .attr("visibility",function(d) { return arcRadius(d) > 3 ? "visible" : "hidden"; })
        .text(function(d) { return d.state == null || d.state == "" ? d.region : d.state; });
}

function drawTimeline() {
    xScale.range([0, svgTimeline.node().clientWidth-20]);
    yScale.range([svgTimeline.node().clientHeight-20,0]);

    svgTimeline.selectAll('.browser').select("path")
        .attr('d', area);

    svgTimeline.selectAll('.xAxis')
        .attr('transform', 'translate(40,' + (svgTimeline.node().clientHeight - 20) + ')')
        .call(xAxis);

    svgTimeline.selectAll('.yAxis')
        .attr('transform', 'translate(40,0)')
        .call(yAxis);
}
