"use strict";
import { select as d3Select} from "d3-selection";

import {scaleLinear,scaleBand} from "d3-scale";
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
import * as d3 from "d3";
import $ from "jquery";

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
        fontSize: null
    },
    enableAxisY: {
        show: true,
        label: false,
        fontSize: null,
        fontSizeLabel: null,
        labelText: "Units"
    },
    generalView: {
        opacity: 100,
        dataOnBar: true,
        enableGradient: true,
        fontSizeDataOnBar: null
    },
    title: {
        hide: false,
        text: "Analyze",
        fontSizeTitle: null
    },
    selectionData: {
        fontSize: null,
        color: "#rgb(96,115,189)"
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
        selectionData: {
            color: dataViewObjects.getValue<powerbi.Fill>(objects, {
                objectName: "selectionData", propertyName: "color",
            }, { solid: { color: defaultSettings.selectionData.color } }).solid.color,
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "selectionData", propertyName: "fontSize",
            }, defaultSettings.selectionData.fontSize)
        },
        enableAxisX: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxisX", propertyName: "show",
            }, defaultSettings.enableAxisX.show),
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "enableAxisX", propertyName: "fontSize",
            }, defaultSettings.enableAxisX.fontSize),
        },
        enableAxisY: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "show",
            }, defaultSettings.enableAxisY.show),
            label: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "label",
            }, defaultSettings.enableAxisY.label),
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "fontSize",
            }, defaultSettings.enableAxisY.fontSize),
            fontSizeLabel: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "fontSizeLabel",
            }, defaultSettings.enableAxisY.fontSizeLabel),
            labelText: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "labelText",
            }, defaultSettings.enableAxisY.labelText),
        },
        generalView: {
            opacity: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "opacity" }, defaultSettings.generalView.opacity),
            dataOnBar: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "dataOnBar" }, defaultSettings.generalView.dataOnBar),
            enableGradient: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "enableGradient" }, defaultSettings.generalView.enableGradient),
            fontSizeDataOnBar: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "fontSizeDataOnBar" }, defaultSettings.generalView.fontSizeDataOnBar)
        },
        title: {
            hide: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "hide" }, defaultSettings.title.hide),
            text: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "text" }, defaultSettings.title.text),
            fontSizeTitle: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "fontSizeTitle" }, defaultSettings.title.fontSizeTitle)
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
    private selectionManager: ISelectionManager;
    private barChartSettings: BarChartSettings;
    private viewModel: BarChartViewModel
    private xAxis: Selection<SVGElement>;
    private yAxis: Selection<SVGElement>;
    private title: Selection<SVGElement>;
    private defs: Selection<SVGElement>;
    private barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private dataBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private categorySelect: Selection<SVGElement>;
    private element: HTMLElement;
    private gradientBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private divSlicer: HTMLDivElement;
    private slicerGroup: Selection<any>
    private dataPointsCategorySelector: BarChartDataPoint[]
    private dataPointsCategorySelectorAll: BarChartDataPoint[]
    private textCategory: Selection<any>
    private options: VisualUpdateOptions
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
        this.selectionManager = options.host.createSelectionManager();
        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(this.barSelection, <ISelectionId[]>this.selectionManager.getSelectionIds(), []);
        });
        this.element = options.element

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


        this.categorySelect = this.svg
            .append('g')
            .classed('categorySelect', true);

    }

    private categoryPanel(heightCategorySelect, widthCategorySelect, height,
        translateXSlicer, translateYSlicer, categorySelectFontSize,
        viewModel, heightYAxis, marginAxisY, marginFirstBar, widthXAxis, fontSizeAxisX, fontSizeAxisY, settings, fontSizeDataOnBar) {
        let maxHeight: number = heightCategorySelect * 5;
        let paddingTop: number = categorySelectFontSize * 1.7
        let paddingTextHorizontal: number = widthCategorySelect * 0.18
        let paddingTextVertical: number = maxHeight * 0.07
        let translateYSlicerGroup: number = heightCategorySelect + height * 0.01

        this.divSlicer = document.createElement('div')
        this.divSlicer.style.position = 'absolute'
        this.divSlicer.style.left = `${translateXSlicer}px`
        this.divSlicer.style.top = `${translateYSlicer + translateYSlicerGroup}px`
        this.divSlicer.style.width = `${widthCategorySelect}px`
        this.divSlicer.style.height = `${maxHeight}px`
        this.element.appendChild(this.divSlicer)
        let svgSlicer = d3Select(this.divSlicer)
            .append('svg')
            .attr('id', 'svgSlicer')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', '100%')
            .attr('height', '100%')



        this.slicerGroup = this.categorySelect
            .append('g')
            .attr("transform", "translate(" + 0 + "," + translateYSlicerGroup + ")")


        this.slicerGroup
            .append('rect')
            .attr('id', 'slicerCategory')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', widthCategorySelect)
            .attr('height', maxHeight)
            .style('fill', 'white')
            .attr('rx', 15)

        let textGroup = svgSlicer.append('g').attr('id', 'textGroup')
            .attr('transform', `translate(${paddingTextHorizontal},${paddingTextVertical})`)


        this.textCategory = textGroup
            .selectAll('text')
            .data(this.dataPointsCategorySelectorAll)
            .enter()
            .append('text')
            .text(d => d.category)
            .attr('x', 0)
            .attr('y', (d, i) => paddingTop * i)
            .attr('alignment-baseline', 'hanging')
            .attr('text-anchor', 'start')
            .style('font-size', categorySelectFontSize)




        const lastTextPositionY: number = parseInt($('svg #textGroup text').last().attr('y'))
        if (lastTextPositionY > maxHeight) {
            this.divSlicer.style.overflowY = 'scroll'
            svgSlicer.attr('height', lastTextPositionY + paddingTextHorizontal + categorySelectFontSize / 2)
        }



        this.textCategory.on('click', (d) => {
            if (this.host.hostCapabilities.allowInteractions) {


                const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
                this.selectionManager
                    .select(d.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.dataPointsCategorySelector = this.dataPointsCategorySelectorAll.filter(d => ids.find(i => i.equals(d.selectionId)))
                        
                        this.update(this.options)
                    });
                (<Event>getEvent()).stopPropagation();
            }
        });


    }

    public update(options: VisualUpdateOptions) {
        this.options = options
    
        this.viewModel = visualTransform(options, this.host);
       
        
        if(this.dataPointsCategorySelector && this.dataPointsCategorySelector.length > 0){
            this.viewModel.dataPoints = this.viewModel.dataPoints.filter(d => this.dataPointsCategorySelector.find(c => c.selectionId
                .equals(d.selectionId)))
        }
        else{
            this.dataPointsCategorySelectorAll = this.viewModel.dataPoints
        }

        
        
        let settings = this.barChartSettings = this.viewModel.settings;
    
       
        let width = options.viewport.width;
        let height = options.viewport.height;

        this.svg.attr("width", width).attr("height", height);

        let paddingTopInfoPanel = height * 0.05
        let paddingTop = height * 0.25  //Отступ диаграм
        let paddingBottom = height * 0.12
        let paddingLeft = width * 0.045
        let paddingRight = paddingLeft

        let marginFirstBar = paddingLeft
        let marginAxisY = height * 0.035


        let fontSizeCustom = width / 1.3 < height ? width * 0.03 : height * 0.045
        let fontSizeDataOnBar = settings.generalView.fontSizeDataOnBar ? settings.generalView.fontSizeDataOnBar : fontSizeCustom / 1.3

        let fontSizeAxisX = settings.enableAxisX.fontSize ? settings.enableAxisX.fontSize : fontSizeCustom
        let fontSizeAxisY = settings.enableAxisY.fontSize ? settings.enableAxisY.fontSize : fontSizeCustom
        let fontSizeTitle = settings.title.fontSizeTitle ? settings.title.fontSizeTitle : fontSizeCustom * 1.5
        let fontSizeLabel = settings.enableAxisY.fontSizeLabel ? settings.enableAxisY.fontSizeLabel : fontSizeCustom / 1.8




        //------Title------
        this.svg.selectAll('text.title').remove()
        if (!settings.title.hide) {
            this.title = this.svg
                .append('text')
                .text(settings.title.text)
                .classed('title', true)
                .attr("transform", `translate(${paddingLeft - 9}, ${paddingTopInfoPanel})`)
                .attr('alignment-baseline', 'hanging')
                .style('font-size', fontSizeTitle)
        }



        this.categorySelect.html('')
        let widthCategorySelect = width * 0.16;
        let heightCategorySelect = height * 0.08

        let categorySelectFontSizeCustom = height < width ? height * 0.035 : width * 0.025
        let categorySelectFontSize = settings.selectionData.fontSize && settings.selectionData.fontSize < categorySelectFontSizeCustom ? settings.selectionData.fontSize : categorySelectFontSizeCustom
        let translateXSlicer = width - paddingRight - widthCategorySelect;
        let translateYSlicer = paddingTopInfoPanel



        //------Отступы------
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
        this.xAxis.attr('transform', `translate(${paddingLeft}, ${height * 0.86})`);
        //Смещение оси y
        this.yAxis.attr('transform', `translate(${paddingLeft}, ${paddingTop})`)




        //---Category selector
        this.categorySelect
            .attr("transform", "translate(" + translateXSlicer + "," + translateYSlicer + ")")

        this.categorySelect
            .append('rect')
            .attr('id', 'select')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', widthCategorySelect)
            .attr('height', heightCategorySelect)
            .attr('rx', 15)
            .style('fill', 'white')

        this.categorySelect
            .append('text')
            .text(this.viewModel.categoryDisplayName)
            .attr('alignment-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .attr('x', widthCategorySelect / 2)
            .attr('y', heightCategorySelect / 2)
            .style('font-size', categorySelectFontSize)
            .style('font-weight', 500)



        if (this.slicerGroup) {
            this.slicerGroup.remove()
            this.slicerGroup = null
            this.divSlicer.remove()
            this.divSlicer = null
            this.categoryPanel(heightCategorySelect, widthCategorySelect, height,
                translateXSlicer, translateYSlicer, categorySelectFontSize,
                this.viewModel, heightYAxis, marginAxisY, marginFirstBar, widthXAxis, fontSizeAxisX, fontSizeAxisY, settings, fontSizeDataOnBar)
        }

        this.categorySelect.selectAll('rect#select, text').on('click', (d) => {
            if (this.host.hostCapabilities.allowInteractions) {
                if (!this.slicerGroup) {
                    this.categoryPanel(heightCategorySelect, widthCategorySelect, height,
                        translateXSlicer, translateYSlicer, categorySelectFontSize,
                        this.viewModel, heightYAxis, marginAxisY, marginFirstBar, widthXAxis, fontSizeAxisX, fontSizeAxisY, settings, fontSizeDataOnBar)
                } else {
                    this.slicerGroup.remove()
                    this.slicerGroup = null
                    this.divSlicer.remove()
                    this.divSlicer = null
                    this.dataPointsCategorySelector = null
                }
            }
        })

        //---Category selector




        this.createAxisAndDiagram(this.viewModel, heightYAxis, marginAxisY, marginFirstBar, widthXAxis, fontSizeAxisX, fontSizeAxisY,
            settings, fontSizeDataOnBar)




      
    }

    private createAxisAndDiagram(viewModel, heightYAxis, marginAxisY, marginFirstBar, widthXAxis, fontSizeAxisX, fontSizeAxisY,
        settings, fontSizeDataOnBar) {


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


        //-----Название оси Y------
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
                .attr('y', -fontSizeAxisY * 2)
                .attr('font-size', settings.enableAxisY.fontSizeLabel)
                .attr('alignment-baseline', 'baseline')
                .text(settings.enableAxisY.labelText)
        }


        // -----Горизонтальные линии----- 
        this.yAxis.selectAll(".tick line")
            .classed("grid-line", true)
            .attr("x1", -10)    // для того чтобы линия начиналась от начала значения на оси Y
            .attr("y1", -fontSizeAxisY)    // для того чтобы линия стояла над значением на оси Y
            .attr("x2", widthXAxis) // ширина линии равняется ширине оси Xs
            .attr("y2", -10);   // для того чтобы линия стояла над значением на оси Y

        this.yAxis.selectAll('.tick text').classed('textYAxis', true)



        const opacity: number = viewModel.settings.generalView.opacity / 100;

        //----- Создание градиента-----
        this.gradientBarSelection = this.defs
            .selectAll('linearGradient')
            .data(viewModel.dataPoints);


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

        if (settings.generalView.enableGradient) {
            gradientBarSelectionMerged
                .append('stop')
                .attr("offset", "100%") //Закончить этим цветом
                .attr("stop-color", "white")
        }




        //-------- Создание диаграммы


        this.barSelection = this.barContainer
            .selectAll('.bar')
            .data(viewModel.dataPoints);

        const barSelectionMerged = this.barSelection
            .enter()
            .append('rect')
            .classed('bar', true)
            .merge(<any>this.barSelection)


        barSelectionMerged
            .attr('rx', 7)
            .attr("width", xScale.bandwidth())
            .attr("height", d => heightYAxis - marginAxisY - yScale(<number>d.value))
            .attr("y", d => yScale(<number>d.value))
            .attr("x", d => xScale(d.category))
            .attr("fill", (dataPoint: BarChartDataPoint, i: number) => `url(#Gradient${i + 1})`)
            .style("fill-opacity", opacity)
            .style("stroke-opacity", opacity)




        //------ Добавление числа над диаграммой
        let dataBarSelectionMerged;
        if (settings.generalView.dataOnBar) {
            this.dataBarSelection = this.barContainer
                .selectAll('.barDataValue')
                .data(viewModel.dataPoints);


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


        barSelectionMerged.on('click', (d) => {
            if (this.host.hostCapabilities.allowInteractions) {
                const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
                this.selectionManager
                    .select(d.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.syncSelectionState(barSelectionMerged, ids,
                            [dataBarSelectionMerged, this.xAxis.selectAll('g.tick text')]);
                    });
                (<Event>getEvent()).stopPropagation();
            }
        });


        this.syncSelectionState(barSelectionMerged, this.selectionManager.getSelectionIds() as ISelectionId[],
            [dataBarSelectionMerged, this.xAxis.selectAll('g.tick text')]);


            this.barSelection.exit().remove();
            this.dataBarSelection.exit().remove();
            this.gradientBarSelection.exit().remove();

    }


    private syncSelectionState(
        selection: Selection<BarChartDataPoint>,
        selectionIds: ISelectionId[],
        additionalElements: Selection<any>[]): void {
        if (!selection || !selectionIds) {
            return;
        }

        if (!selectionIds.length) {
            const opacity: number = this.barChartSettings.generalView.opacity / 100;
            selection
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);

            additionalElements.forEach(e =>
                e.classed('opacityLess', false)
            )
            return;
        }

        const self: this = this;

        additionalElements.forEach(e =>
            e.classed('opacityLess', true)
        )

        selection.each(function (barDataPoint: BarChartDataPoint, index: number) {
            const isSelected: boolean = self.isSelectionIdInArray(selectionIds, barDataPoint.selectionId);

            const opacity: number = isSelected
                ? BarChart.Config.solidOpacity
                : BarChart.Config.transparentOpacity;


            d3Select(this)

                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);


            if (isSelected) {
                additionalElements.forEach(e =>
                    e.filter((d, i) => i === index)
                        .classed('opacityLess', false)
                )
            }
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
        console.log(this.viewModel);
        if (!this.barChartSettings ||
            !this.barChartSettings.enableAxisX ||
            !this.barChartSettings.enableAxisY ||
            !this.viewModel.dataPoints) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'title':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        text: this.barChartSettings.title.text,
                        hide: this.barChartSettings.title.hide,
                        fontSizeTitle: this.barChartSettings.title.fontSizeTitle
                    },
                    validValues: {
                        fontSizeTitle: {
                            numberRange: {
                                min: 6,
                                max: 40
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'enableAxisX':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        show: this.barChartSettings.enableAxisX.show,
                        fontSize: this.barChartSettings.enableAxisX.fontSize
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
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
                        fontSize: this.barChartSettings.enableAxisY.fontSize,
                        fontSizeLabel: this.barChartSettings.enableAxisY.fontSizeLabel,
                        labelText: this.barChartSettings.enableAxisY.labelText
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        },
                        fontSizeLabel: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'colorSelector':
                
                
                for (let barDataPoint of this.viewModel.dataPoints) {
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
                        enableGradient: this.barChartSettings.generalView.enableGradient,
                        fontSizeDataOnBar: this.barChartSettings.generalView.fontSizeDataOnBar
                    },
                    validValues: {
                        opacity: {
                            numberRange: {
                                min: 10,
                                max: 100
                            }
                        },
                        fontSizeDataOnBar: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'selectionData':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fontSize: this.barChartSettings.selectionData.fontSize,
                        color: this.barChartSettings.selectionData.color
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
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