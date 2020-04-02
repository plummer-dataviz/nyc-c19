import React, { useState, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { find, compact, sumBy } from "lodash";
import "./App.css";

const width = 1080;
const height = 550;
const margin = { top: 20, bottom: 20, left: 40, right: 40 };

function buildMap(node, mapData, data, setActiveBorough, activeBorough) {
  const projection = d3
    .geoConicConformal()
    .parallels([33, 45])
    .rotate([96, -39])
    .fitSize([width / 1.1, height / 1.1], mapData);

  const path = d3.geoPath().projection(projection);

  let svg;
  if (!node.children.length) {
    svg = d3
      .select(node)
      .append("svg")
      .attr("width", width)
      .attr("height", height);
  } else {
    svg = d3.select(node.children[0]);
  }

  const boroughs = svg
    .selectAll(".borough")
    .data(mapData.features)
    .join("path")
    .attr("d", path)
    .attr("class", "borough")
    .attr("fill", d => {
      if (!activeBorough) {
        return "rgb(255, 213, 210)";
      }
      if (activeBorough === d.properties.name) {
        return "rgb(255, 213, 210)";
      }
      return "#e8e8e8";
    })
    .on("mouseover", d => {
      setActiveBorough(d.properties.name);
    });

  boroughs.append("title").text(d => d.properties.name);

  const labels = svg
    .append("g")
    .selectAll(".label")
    .data(mapData.features)
    .enter()
    .append("text")
    .attr("class", "halo")
    .attr("transform", function(d) {
      return "translate(" + path.centroid(d) + ")";
    })
    .style("text-anchor", "middle")
    .text(function(d) {
      return d.properties.name;
    });

  // const color = d3
  //   .scaleLinear()
  //   .domain([0, false === "cases-per-capita" ? 0.001 : 0.0001])
  //   .interpolate(() => d3.interpolateOranges);
}

function sanitizeCounty(county) {
  switch (county) {
    case "Kings":
      return "Brooklyn";
    case "New York":
      return "Manhattan";
    case "Richmond":
      return "Staten Island";
    default:
      return county;
  }
}

function cleanData(rawData) {
  let nycData = rawData
    .filter(d => {
      return ["Kings", "New York", "Bronx", "Queens", "Richmond"].includes(
        d["County Name"].replace(" County", "")
      );
    })
    .filter(d => d["State"] === "NY");
  nycData = nycData.reduce((acc, curr) => {
    const entries = Object.entries(curr);
    entries.splice(0, 4);
    const massagedData = entries.map(dates => {
      if (new Date(dates[0]) < new Date("2020-03-07")) return null;
      return {
        date: new Date(dates[0]),
        cases: dates[1],
        borough: sanitizeCounty(curr["County Name"].replace(" County", ""))
      };
    });
    acc = [...acc, ...massagedData];
    return acc;
  }, []);
  return compact(nycData);
}

function buildAreaChart(node, data, activeBorough) {
  const nestedData = d3
    .nest()
    .key(function(d) {
      return d.date;
    })
    .entries(data);
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([margin.left, width - margin.right]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(nestedData, d => sumBy(d.values, "cases"))])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(xScale);
  let svg;
  if (!node.children.length) {
    svg = d3
      .select(node)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    svg
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .append("text")
      .attr("class", "axis-label")
      .attr("x", "50%")
      .attr("dy", "3em");

    svg
      .append("g")
      .attr("class", "axis y-axis")
      .attr("transform", `translate(${width - margin.right}, 0)`)
      .call(d3.axisRight(yScale))
      .append("text")
      .attr("class", "axis-label")
      .attr("y", "50%")
      .attr("dx", "-3em")
      .attr("writing-mode", "vertical-rl");
  } else {
    svg = d3.select(node.children[0]);
  }

  drawArea(svg, data, xScale, yScale, activeBorough);
}

function drawArea(svg, data, xScale, yScale, activeBorough) {
  const boroughs = [...new Set(data.map(d => d.borough))];
  const nestedData = d3
    .nest()
    .key(function(d) {
      return d.date;
    })
    .entries(data);
  // const stack = d3
  //   .stack()
  //   .keys(boroughs)
  //   .value((d, k) => {
  //     return find(d.values, "borough", k).cases;
  //   })(nestedData);

  let color = key => {
    if (!activeBorough) {
      return "rgb(255, 213, 210)";
    }
    if (activeBorough === key) {
      return "rgb(255, 213, 210)";
    }
    return "#e8e8e8";
  };

  svg
    .selectAll(`path.area`)
    .data([nestedData])
    .join(
      enter => enter.append("path").attr("fill-opacity", 0),
      update => update,
      exit => exit.remove()
    )
    .call(selection => {
      selection
        .transition()
        .duration(1000)
        .attr("fill-opacity", 1)
        .attr("fill", ({ key }) => color(key))
        .attr("stroke", "none")
        .attr("class", d => {
          return `area ${activeBorough} active`;
        })
        .attr(
          "d",
          d3
            .area()
            .x(d => {
              return xScale(new Date(d.key));
            })
            .y0(d => {
              return yScale(0);
            })
            .y1(d => {
              let test = find(d.values, { borough: activeBorough })?.cases;
              if (!activeBorough) {
                test = sumBy(d.values, "cases");
              }
              return yScale(test);
            })
        );
    })
    .append("title")
    .text(({ key }) => key);

  svg
    .selectAll(`path.totalArea`)
    .data([nestedData])
    .join(
      enter => enter.append("path").attr("fill-opacity", 0),
      update => update,
      exit => exit.remove()
    )
    .call(selection => {
      selection
        .attr("fill-opacity", 0.3)
        .attr("fill", d => color(d))
        .attr("stroke", "none")
        .attr("class", d => {
          return `area total`;
        })
        .attr(
          "d",
          d3
            .area()
            .x(d => {
              return xScale(new Date(d.key));
            })
            .y0(d => {
              return yScale(0);
            })
            .y1(d => {
              let y1 = sumBy(d.values, "cases");

              return yScale(y1);
            })
        );
    })
    .append("title")
    .text(({ key }) => key);

  // svg
  //   .selectAll("text.inline-label.cases")
  //   .data(nestedData)
  //   .join("text")
  //   .attr("class", "inline-label cases")
  //   .attr("visibility", "hidden")
  //   .attr("dx", d => {
  //     let cases =
  //       find(d.values, { borough: activeBorough })?.cases ||
  //       sumBy(d.values, "cases");
  //     return `${cases}em`;
  //   })

  //   .attr("dy", "-0.5em")
  //   .attr("x", d => {
  //     xScale(new Date(d.key));
  //   })
  //   .attr("y", d => d3.max([yScale(0), yScale(sumBy(d.values, "cases"))]))
  //   .text(d => {
  //     let cases =
  //       find(d.values, { borough: activeBorough })?.cases ||
  //       sumBy(d.values, "cases");
  //       return cases;
  //   })
  //   .attr("visibility", "visible")
  //   .call(text =>
  //     text
  //       .filter((d, i, data) => i === data.length - 1)
  //       .append("tspan")
  //       .attr("font-weight", "bold")
  //       .text(
  //         d =>
  //           " " +
  //           (find(d.values, { borough: activeBorough })?.cases <= 1
  //             ? "case"
  //             : "cases")
  //       )
  //   );
}

function ChartsContainer() {
  const [data, setData] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [activeBorough, setActiveBorough] = useState(null);
  const mapRef = useCallback(
    node => {
      if (node !== null && mapData !== null && data != null) {
        buildMap(node, mapData, data, setActiveBorough, activeBorough);
      }
    },
    [mapData, data, activeBorough]
  );
  const areaRef = useCallback(
    node => {
      if (node !== null && data != null) {
        buildAreaChart(node, data, activeBorough);
      }
    },
    [data, activeBorough]
  );

  useEffect(() => {
    const fetchData = async () => {
      const response = await d3.csv(
        "./covid_confirmed_usafacts.csv",
        d3.autoType
      );
      const nycData = cleanData(response);

      setData(nycData);
    };
    if (data === null) {
      fetchData();
    }
  }, [data]);

  useEffect(() => {
    async function fetchMapData() {
      const response = await d3.json("./new-york-city-boroughs.geojson.json");
      setMapData(response);
    }
    if (mapData === null) {
      fetchMapData();
    }
  }, [mapData]);

  return (
    <div className="ChartsContainer">
      <header className="App-header">
        Confirmed Cases of Covid-19 by NYC Borough
      </header>
      <div className="MapsContainer" ref={mapRef} />
      <div className="AreaContainer" ref={areaRef} />
    </div>
  );
}

export default ChartsContainer;
