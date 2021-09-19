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
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import { BarChartSettings } from "./settings";
type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import { dataViewObjects, dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";

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
    measureDisplayName: string;
    categoryDisplayName: string;
}

let defaultSettings: BarChartSettings = {
    enableAxisX: {
        show: true,
    },
    enableAxisY: {
        show: true,
        label: false
    },
    generalView: {
        opacity: 100,
        dataOnBar: true
    },
    title: {
        hide: false,
        text: "Analyze"
    }
};


function visualTransform(options: VisualUpdateOptions, host: IVisualHost): BarChartViewModel {
    let dataViews = options.dataViews;
    let viewModel: BarChartViewModel = {
        dataPoints: [],
        dataMax: 0,
        settings: <BarChartSettings>{},
        categoryDisplayName: "",
        measureDisplayName: ""
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
        enableAxisX: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxisX", propertyName: "show",
            }, defaultSettings.enableAxisX.show),
        },
        enableAxisY: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "show",
            }, defaultSettings.enableAxisY.show),
            label: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "label",
            }, defaultSettings.enableAxisY.label)
        },
        generalView: {
            opacity: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "opacity" }, defaultSettings.generalView.opacity),
            dataOnBar: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "dataOnBar" }, defaultSettings.generalView.dataOnBar)
        },
        title: {
            hide: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "hide" }, defaultSettings.title.hide),
            text: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "text" }, defaultSettings.title.text),
        }
    };

    dataMax = <number>dataValue.maxLocal || <number>dataValue.max;

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

    let measureDisplayName = dataValue.source.displayName;
    let categoryDisplayName = categorical.categories[0].source.displayName;


    return {
        dataPoints: barChartDataPoints,
        dataMax: dataMax,
        settings: barChartSettings,
        categoryDisplayName: categoryDisplayName,
        measureDisplayName: measureDisplayName
    };
}

export class BarChart implements IVisual {
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
    private defs: Selection<SVGElement>;
    private barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private dataBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;

    private gradientBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;

    static Config = {
        solidOpacity: 1,
        transparentOpacity: 0.4,
        xAxisFontMultiplier: 0.042,
        yAxisFontMultiplier: 0.039,
        titleFontMultiplier: 0.05,
        dataOnBarFontMultiplier: 0.042,
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


        this.xAxis = this.svg
            .append('g')
            .classed('xAxis', true);

        this.yAxis = this.svg
            .append('g')
            .classed('yAxis', true);

        this.barContainer = this.svg
            .append('g')
            .classed('barContainer', true);


        this.defs = this.svg.append('defs')

    }

    public update(options: VisualUpdateOptions) {

        let viewModel: BarChartViewModel = visualTransform(options, this.host);
        let settings = this.barChartSettings = viewModel.settings;
        this.barDataPoints = viewModel.dataPoints;
        let width = options.viewport.width;
        let height = options.viewport.height;

        this.svg.attr("width", width).attr("height", height);

        let paddingTop = height * 0.16
        let paddingBottom = height * 0.12
        let paddingLeft = width * 0.045
        let paddingRight = paddingLeft

        let marginFirstBar = paddingLeft
        let marginAxisY = height * 0.035
      
        
        let fontSizeAxisX = Math.min(height, width) * BarChart.Config.xAxisFontMultiplier;
        let fontSizeAxisY = Math.min(height, width) * BarChart.Config.yAxisFontMultiplier;
        let fontSizeTitle = Math.min(height, width) * BarChart.Config.titleFontMultiplier;
        let fontSizeDataOnBar = Math.min(height, width) * BarChart.Config.dataOnBarFontMultiplier;

        this.svg.selectAll('text.title').remove()
        if (!settings.title.hide) {
            this.title = this.svg
                .append('text')
                .text(settings.title.text)
                .classed('title', true)
                .attr("transform", `translate(${paddingLeft - 9}, ${fontSizeAxisY * 2})`)
                .style('font-size', fontSizeTitle)
        }

        //Убираем отступы и оси если пользователь отключил
        if (!settings.enableAxisX.show) {
            paddingBottom = 20
            this.xAxis.classed('remove', true)
        } else {
            this.xAxis.classed('remove', false)
        }

        if (!settings.enableAxisY.show) {
            this.yAxis.classed('remove', true)
            paddingLeft = 0
            paddingRight = 0
        } else {
            this.yAxis.classed('remove', false)
        }


        let heightYAxis = height - paddingTop - paddingBottom
        let widthXAxis = width - paddingLeft - paddingRight


        //Смещение диаграм
        this.barContainer.attr('transform', `translate(${paddingLeft}, ${paddingTop})`);
        //Смещение оси x
        this.xAxis.attr('transform', `translate(${paddingLeft}, ${heightYAxis + paddingTop})`);
        //Смещение оси y
        this.yAxis.attr('transform', `translate(${paddingLeft}, ${paddingTop})`)


        //функция интерполяции оси Y
        let yScale = scaleLinear()
            .domain([viewModel.dataMax, 0])
            .range([0, heightYAxis - marginAxisY]);
        //функция интерполяции оси X
        let xScale = scaleBand()
            .domain(viewModel.dataPoints.map(d => d.category))
            .rangeRound([marginFirstBar, widthXAxis])
            .padding(0.6);

        //создаем оси
        let xAxis = axisBottom(xScale);
        let yAxis = axisLeft(yScale).ticks(4);  //ticks - задание количества делений, но движок d3 окончательно сам принимает решение
        this.xAxis.call(xAxis);
        this.yAxis.call(yAxis);

        this.xAxis.style('font-size', fontSizeAxisX)
        this.yAxis.style('font-size', fontSizeAxisY)

        //Удаление названия оси перед его добавлением
        this.yAxis
            .selectAll('text.labelY')
            .remove()

        if (settings.enableAxisY.label) {
            //Добавление названия оси Y
            this.yAxis
                .select('g.tick')
                .append('text')
                .classed('labelY', true)
                .attr('x', -9)  // значения на оси x имеют атрибут x = -9
                .attr('y', -fontSizeAxisY * 1.5)
                .text(viewModel.measureDisplayName)
        }

        // рисуем горизонтальные линии 
        this.yAxis.selectAll(".tick line")
            .classed("grid-line", true)
            .attr("x1", -10)    // для того чтобы линия начиналась от начала значения на оси Y
            .attr("y1", -fontSizeAxisY)    // для того чтобы линия стояла над значением на оси Y
            .attr("x2", widthXAxis) // ширина линии равняется ширине оси Xs
            .attr("y2", -10);   // для того чтобы линия стояла над значением на оси Y

        this.yAxis.selectAll('.tick text').classed('textYAxis', true)



        const opacity: number = viewModel.settings.generalView.opacity / 100;

        //----- Создание градиента

        this.gradientBarSelection = this.defs
            .selectAll('linearGradient')
            .data(this.barDataPoints);


        const gradientBarSelectionMerged = this.gradientBarSelection
            .enter()
            .append("linearGradient")
            .merge(<any>this.gradientBarSelection)

        gradientBarSelectionMerged
            .attr("id", (dataPoint: BarChartDataPoint, i: number) => `Gradient${i + 1}`)  //Индекс для того чтобы для каждого bar был свой элемент linearGradient нужно прописать айди уникальный
            .attr("x1", "0")    //Координаты заливки чтобы залить вертикально сверху вниз
            .attr("x2", "0")
            .attr("y1", "0")
            .attr("y2", "1")


        gradientBarSelectionMerged.selectAll('stop').remove()   //При обновлении удаляем элементы stop и дальше заменяем их обновленными

        gradientBarSelectionMerged
            .append("stop")
            .attr("offset", "0%")   //Начать с этого цвета 
            .attr("stop-color", (dataPoint: BarChartDataPoint) => dataPoint.color)

        gradientBarSelectionMerged
            .append('stop')
            .attr("offset", "100%") //Закончить этим цветом
            .attr("stop-color", "white")

        //-----------------  Создание градиента



        //-------- Создание диаграммы

        this.barSelection = this.barContainer
            .selectAll('.bar')
            .data(this.barDataPoints);

        const barSelectionMerged = this.barSelection
            .enter()
            .append('rect')
            .classed('bar', true)
            .merge(<any>this.barSelection)


        barSelectionMerged
            .attr('rx', 9)
            .attr("width", xScale.bandwidth())
            .attr("height", d => heightYAxis - marginAxisY - yScale(<number>d.value))
            .attr("y", d => yScale(<number>d.value))
            .attr("x", d => xScale(d.category))
            .attr("fill", (dataPoint: BarChartDataPoint, i: number) => `url(#Gradient${i + 1})`)
            .style("fill-opacity", opacity)
            .style("stroke-opacity", opacity)

        //------------------  Создание диаграммы


        let dataBarSelectionMerged;
        //------ Добавление числа над диаграммой
        if (settings.generalView.dataOnBar) {
            this.dataBarSelection = this.barContainer
                .selectAll('.barDataValue')
                .data(this.barDataPoints);


            dataBarSelectionMerged = this.dataBarSelection
                .enter()
                .append('text')
                .classed('barDataValue', true)
                .merge(<any>this.dataBarSelection);


            dataBarSelectionMerged
                .text((d: BarChartDataPoint) => Math.round(<number>d.value))
                .attr("y", (d: BarChartDataPoint) => yScale(<number>d.value) - fontSizeDataOnBar / 2)
                .attr("x", (d: BarChartDataPoint) => xScale(d.category) + xScale.bandwidth() / 2)
                .style('font-size', fontSizeDataOnBar)
        } else {
            this.barContainer.selectAll('text').remove()
        }

        //------------------  Добавление числа над диаграммой



        barSelectionMerged.on('click', (d) => {
            // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)
            if (this.host.hostCapabilities.allowInteractions) {
                const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
                this.selectionManager
                    .select(d.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.syncSelectionState(barSelectionMerged, ids);
                        this.syncSelectionState(dataBarSelectionMerged, ids);
                    });
                (<Event>getEvent()).stopPropagation();
            }
        });


        this.barSelection.exit().remove();
        this.dataBarSelection.exit().remove();
        this.gradientBarSelection.exit().remove();
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
            !this.barChartSettings.enableAxisX ||
            !this.barChartSettings.enableAxisY ||
            !this.barDataPoints) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'title':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        text: this.barChartSettings.title.text,
                        hide: this.barChartSettings.title.hide
                    },
                    selector: null
                });
                break;
            case 'enableAxisX':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        show: this.barChartSettings.enableAxisX.show,
                    },
                    selector: null
                });
                break;
            case 'enableAxisY':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        show: this.barChartSettings.enableAxisY.show,
                        label: this.barChartSettings.enableAxisY.label,
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
                        dataOnBar: this.barChartSettings.generalView.dataOnBar,
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