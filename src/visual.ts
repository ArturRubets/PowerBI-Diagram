"use strict";
import {
    select as d3Select
} from "d3-selection";

import {
    scaleLinear,
    scaleBand
} from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import { VisualSettings, BarChartSettings } from "./settings";
type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import { dataRoleHelper, dataViewObjects, dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import { textMeasurementService } from "powerbi-visuals-utils-formattingutils";
import { timeStamp } from "console";

const getEvent = () => require("d3-selection").event;

interface BarChartDataPoint {
    value: powerbi.PrimitiveValue;
    category: string;
    color: string;
    selectionId: ISelectionId;
}


interface BarChartViewModel {
    dataPoints: BarChartDataPoint[];
    dataMax: number;
    settings: BarChartSettings;
}

let defaultSettings: BarChartSettings = {
    enableAxis: {
        show: true,
        fill: "#000000",
    },
    generalView: {
        opacity: 100,
    }
};


function visualTransform(options: VisualUpdateOptions, host: IVisualHost): BarChartViewModel {
    let dataViews = options.dataViews;
    let viewModel: BarChartViewModel = {
        dataPoints: [],
        dataMax: 0,
        settings: <BarChartSettings>{}
    };

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.values
    ) {
        return viewModel;
    }

    let categorical = dataViews[0].categorical;
    let category = categorical.categories[0];
    let dataValue = categorical.values[0];

    let barChartDataPoints: BarChartDataPoint[] = [];
    let dataMax: number;

    let objects = dataViews[0].metadata.objects;

    let barChartSettings: BarChartSettings = {
        enableAxis: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxis", propertyName: "show",
            }, defaultSettings.enableAxis.show),
            fill: dataViewObjects.getValue<powerbi.Fill>(objects, { objectName: "enableAxis", propertyName: "fill" }, { solid: { color: defaultSettings.enableAxis.fill } }).solid.color
        },
        generalView: {
            opacity: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "opacity" }, defaultSettings.generalView.opacity)
        }
    };

    dataMax = <number>dataValue.maxLocal;

    const defaultColor = {
        solid: {
            blue: "#5065B6",
            red: "#E55D58",
        }
    };


    for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
        let colorDefault = i % 2 === 0 ? defaultColor.solid.blue : defaultColor.solid.red;
        let object = category.objects != undefined ? category.objects[i] : null

        const color: string = dataViewObjects.getValue<powerbi.Fill>(object, { objectName: "colorSelector", propertyName: "fill" }, { solid: { color: colorDefault } }).solid.color;

        const selectionId: ISelectionId = host.createSelectionIdBuilder()
            .withCategory(category, i)
            .createSelectionId();

        barChartDataPoints.push({
            color: color,
            selectionId,
            value: dataValue.values[i],
            category: `${category.values[i]}`,
        });
    }

    return {
        dataPoints: barChartDataPoints,
        dataMax: dataMax,
        settings: barChartSettings,
    };
}

export class BarChart implements IVisual {
    //Удалить
    // private target: HTMLElement;
    // private updateCount: number;
    // private settings: VisualSettings;
    // private textNode: Text;

    private svg: Selection<any>;
    private barContainer: Selection<SVGElement>;
    private host: IVisualHost;
    private element: HTMLElement;
    private selectionManager: ISelectionManager;
    private barChartSettings: BarChartSettings;
    private barDataPoints: BarChartDataPoint[];
    private xAxis: Selection<SVGElement>;
    private yAxis: Selection<SVGElement>;
    private title: Selection<SVGElement>;
    private barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private dataBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;

    private groupBarSelectionMerged: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    
    static Config = {
        xScalePadding: 0.1,
        solidOpacity: 1,
        transparentOpacity: 0.4,
        margins: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        },
        xAxisFontMultiplier: 0.04,
    };


    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.element = options.element;
        this.selectionManager = options.host.createSelectionManager();
        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(this.barSelection, <ISelectionId[]>this.selectionManager.getSelectionIds());
            this.syncSelectionState(this.dataBarSelection, <ISelectionId[]>this.selectionManager.getSelectionIds());
        });

        this.svg = d3Select(options.element)
            .append('svg')
            .classed('barChart', true);
        this.barContainer = this.svg
            .append('g')
            .classed('barContainer', true);


        this.xAxis = this.svg
            .append('g')
            .classed('xAxis', true);



        this.yAxis = this.svg
            .append('g')
            .classed('yAxis', true);

        this.title = this.svg

            .append('text')
            .text('Analyze')
            .classed('title', true)

    }

    public update(options: VisualUpdateOptions) {

        let viewModel: BarChartViewModel = visualTransform(options, this.host);
        let settings = this.barChartSettings = viewModel.settings;
        this.barDataPoints = viewModel.dataPoints;
        let width = options.viewport.width;
        let height = options.viewport.height;
        let heightBarChart;
        let margins = BarChart.Config.margins;

        this.svg.attr("width", width).attr("height", height);

        let paddingTop = height * 0.15
        let paddingBottom = height * 0.15
        let heightYAxis = height - paddingTop - paddingBottom
        let paddingLeft = 40
        let paddingRight = 40

        let widthXAxis = width - paddingLeft - paddingRight

        this.title.attr("transform", `translate(${paddingLeft / 2}, ${paddingTop / 2})`)


        //if (settings.enableAxis.show) {

        // height -= margins.top  + margins.bottom;   //высота оси y
        // heightBarChart = height - margins.bottom //высота диаграммы
        //}

        //width -= margins.left * 4

        //Смещение диаграм
        this.barContainer.attr('transform', `translate(${paddingLeft}, ${0})`);
        //Смещение оси x
        this.xAxis.attr('transform', `translate(${paddingLeft}, ${heightYAxis + paddingTop})`);
        //Смещение оси y
        this.yAxis.attr('transform', `translate(${paddingLeft}, ${paddingTop})`)


        // let xAxisFontMultiplier = 0.04
        this.xAxis.style("font-size", 12)   //Math.min(height, width) * xAxisFontMultiplier
        // .style("fill", settings.enableAxis.fill);


        //функция интерполяции
        let yScale = scaleLinear()
            .domain([viewModel.dataMax, 0])
            .range([0, heightYAxis]);
        //функция интерполяции
        let xScale = scaleBand()
            .domain(viewModel.dataPoints.map(d => d.category))
            .rangeRound([0, width - paddingRight * 1.5])
            .padding(0.5);


        let xAxis = axisBottom(xScale);

        let yAxis = axisLeft(yScale).ticks(4);





        //const colorObjects = options.dataViews[0] ? options.dataViews[0].metadata.objects : null;

        //создаем ось
        this.xAxis.call(xAxis);
        //    .attr("color", getAxisTextFillColor(
        //     colorObjects,
        //     defaultSettings.enableAxis.fill
        // )
        // )

        //создаем ось
        this.yAxis.call(yAxis);

        // .attr("color", getAxisTextFillColor(
        //     colorObjects,
        //     defaultSettings.enableAxis.fill
        // )
        // )

        // const textNodes = this.xAxis.selectAll("text")
        // BarChart.wordBreak(textNodes, xScale.bandwidth(), height);



        //Размер шрифта
        //this.xAxis.selectAll('g.tick text').attr(`font-size', '${height * 0.05}`)


        // рисуем горизонтальные линии 
        this.yAxis.selectAll(".tick line")
            .classed("grid-line", true)
            .attr("x1", -10)    // -10 для того чтобы линия начиналась от начала значения на оси Y
            .attr("y1", -10)    // -10 для того чтобы линия стояла над значением на оси Y
            .attr("x2", widthXAxis) // ширина линии равняется ширине оси Xs
            .attr("y2", -10);   // -10 для того чтобы линия стояла над значением на оси Y

        this.yAxis.selectAll('.tick text').classed('textYAxis', true)






        const opacity: number = viewModel.settings.generalView.opacity / 100;

        //-----Создание обьекта для обрезки углов у прямоугольника, диаграмма будет иметь закругленные углы
    //    this.barContainer
    //         .append('defs')
    //         .append("clipPath")
    //         .attr("id", "round-corner")
    //         .append("rect")
    //         .attr("x", this.config().image.indentX)
    //         .attr("y", this.config().image.indentY)
    //         .attr("width", settings.card.width - this.config().image.indentX * 2)
    //         .attr('height', settings.image.height)
    //         .attr('rx', settings.image.borderRadius);


        //------------------------------



        //--------Создание диаграммы

        this.barSelection = this.barContainer
        .selectAll('.bar')
        .data(this.barDataPoints);



        const groupBarSelectionMerged = this.barSelection
            .enter()
            .append('g')         
            .merge(<any>this.barSelection)           
        


        groupBarSelectionMerged
            .append('rect')
            .classed('bar', true)
            .attr('rx', 10)
            .attr("width", xScale.bandwidth())
            .attr("height", d => heightYAxis - yScale(<number>d.value))
            .attr("y", d => yScale(<number>d.value) + paddingTop)
            .attr("x", d => xScale(d.category))
            .style("fill-opacity", opacity)
            .style("stroke-opacity", opacity)
            .style("fill", (dataPoint: BarChartDataPoint) => dataPoint.color)

            
        //----------------------------


        //------Добавление числа над диаграммой
        // this.dataBarSelection = this.barContainer
        //     .selectAll('.barDataValue')
        //     .data(this.barDataPoints);
      
        

        // const dataBarSelectionMerged = this.dataBarSelection
        //     .enter()
        //     .append('text')
        //     .merge(<any>this.dataBarSelection);


            groupBarSelectionMerged
            .append('text')
            .classed('barDataValue', true)
            .text((d: BarChartDataPoint) => Math.round(<number>d.value))
            .attr("y", (d: BarChartDataPoint) => yScale(<number>d.value) + paddingTop - 5)
            .attr("x", (d: BarChartDataPoint) => xScale(d.category) + xScale.bandwidth() / 2)
        //-----------------------------------




        groupBarSelectionMerged.on('click', (d) => {
            // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)
            if (this.host.hostCapabilities.allowInteractions) {
                const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
                this.selectionManager
                    .select(d.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.syncSelectionState(groupBarSelectionMerged.selectAll('.bar'), ids);
                        this.syncSelectionState(dataBarSelectionMerged, ids);
                    });
                (<Event>getEvent()).stopPropagation();
            }
        });


        this.barSelection
            .exit()
            .remove();
    }

    private static wordBreak(
        textNodes: Selection<any, SVGElement>,
        allowedWidth: number,
        maxHeight: number
    ) {
        textNodes.each(function () {
            textMeasurementService.wordBreak(
                this,
                allowedWidth,
                maxHeight);
        });
    }

    private syncSelectionState(
        selection: Selection<BarChartDataPoint>,
        selectionIds: ISelectionId[]
    ): void {
        if (!selection || !selectionIds) {
            return;
        }

        if (!selectionIds.length) {
            const opacity: number = this.barChartSettings.generalView.opacity / 100;
            selection
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);
            return;
        }

        const self: this = this;

        
        selection.each(function (barDataPoint: BarChartDataPoint) {
            const isSelected: boolean = self.isSelectionIdInArray(selectionIds, barDataPoint.selectionId);

            const opacity: number = isSelected
                ? BarChart.Config.solidOpacity
                : BarChart.Config.transparentOpacity;

                console.log(opacity);
                
            d3Select(this)
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);
        });
    }

    private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
        if (!selectionIds || !selectionId) {
            return false;
        }

        return selectionIds.some((currentSelectionId: ISelectionId) => {
            return currentSelectionId.includes(selectionId);
        });
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        if (!this.barChartSettings ||
            !this.barChartSettings.enableAxis ||
            !this.barDataPoints) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'enableAxis':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        show: this.barChartSettings.enableAxis.show,
                        fill: this.barChartSettings.enableAxis.fill,
                    },
                    selector: null
                });
                break;
            case 'colorSelector':
                for (let barDataPoint of this.barDataPoints) {
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: barDataPoint.category,
                        properties: {
                            fill: {
                                solid: {
                                    color: barDataPoint.color
                                }
                            }
                        },
                        propertyInstanceKind: {
                            fill: powerbi.VisualEnumerationInstanceKinds.ConstantOrRule
                        },
                        altConstantValueSelector: barDataPoint.selectionId.getSelector(),
                        selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals)
                    });
                }
                break;
            case 'generalView':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        opacity: this.barChartSettings.generalView.opacity,
                    },
                    validValues: {
                        opacity: {
                            numberRange: {
                                min: 10,
                                max: 100
                            }
                        }
                    },
                    selector: null
                });
                break;
        };

        return objectEnumeration;
    }
}


function getAxisTextFillColor(
    objects: powerbi.DataViewObjects,
    defaultColor: string
): string {

    return dataViewObjects.getValue<powerbi.Fill>(
        objects,
        {
            objectName: "enableAxis",
            propertyName: "fill"
        },
        {
            solid: {
                color: defaultColor,
            }
        },
    ).solid.color;
}
