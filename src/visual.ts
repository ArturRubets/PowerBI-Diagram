"use strict";
import { select as d3Select } from "d3-selection";
import { scaleLinear, scaleBand } from "d3-scale";
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
        color: "#5065B6"
    }
};

export class BarChart implements IVisual {
    private svg: Selection<any>;
    private barContainer: Selection<SVGElement>;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private viewModel: BarChartViewModel
    private xAxis: Selection<SVGElement>;
    private yAxis: Selection<SVGElement>;
    private defs: Selection<SVGElement>;
    private barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private dataBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private element: HTMLElement;
    private gradientBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;


    private dataPointsCategorySelector: BarChartDataPoint[]
    private dataPointsCategorySelectorAll: BarChartDataPoint[]
    private textCategory: Selection<any>
    private options: VisualUpdateOptions
    private bars: Selection<any>
    private dataOnBars: Selection<any>
    private axisX: Selection<any>


    private filterCategoryG: Selection<SVGElement>
    private filterCategoryRect: Selection<SVGElement>
    private filterCategoryText: Selection<SVGElement>
    private dropDownListDiv: HTMLDivElement;
    private dropDownListSvg: Selection<any>
    //private dropDownListG: Selection<any>
    private dropDownListRect: Selection<any>
    private dropDownListTextGroup: Selection<any>


    private settings: BarChartSettings
    private paddingLeft: number
    private paddingTop: number
    private paddingBottom: number
    private paddingRight: number
    private marginFirstBar: number
    private marginAxisY: number
    private paddingTopInfoPanel: number
    private fontSizeTitle: number
    private fontSizeCustom: number
    private fontSizeDataOnBar: number
    private fontSizeAxisX: number
    private fontSizeAxisY: number
    private fontSizeLabel: number
    private heightYAxis: number
    private widthXAxis: number
    private width: number
    private height: number
    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();
        this.selectionManager.registerOnSelectCallback(() => {
            this.selectionManager.registerOnSelectCallback((ids: ISelectionId[]) => {
                this.clickDiagramHandler(ids)
            });
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






        this.filterCategoryG = this.svg
            .append('g')
            .classed('filterCategory', true);

        this.filterCategoryRect = this.filterCategoryG
            .append('rect')

        this.filterCategoryText = this.filterCategoryG
            .append('text')

        this.dropDownListDiv = document.createElement('div')
        this.element.appendChild(this.dropDownListDiv)

        this.dropDownListSvg = d3Select(this.dropDownListDiv).append('svg')
        //this.dropDownListG  = this.dropDownListSvg.append('g')
        this.dropDownListRect = this.dropDownListSvg.append('rect')
        this.dropDownListTextGroup = this.dropDownListSvg.append('g')
    }

    public update(options: VisualUpdateOptions) {
        this.options = options
        this.width = options.viewport.width;
        this.height = options.viewport.height;
        this.svg.attr("width", this.width).attr("height", this.height);
        this.viewModel = visualTransform(options, this.host);
        this.setDataPoints()

        this.settings = this.viewModel.settings;
        this.paddingTopInfoPanel = this.height * 0.05
        this.paddingTop = this.height * 0.25  //Отступ диаграм
        this.paddingBottom = this.height * 0.12
        this.paddingLeft = this.width * 0.045
        this.paddingRight = this.paddingLeft
        this.marginFirstBar = this.paddingLeft
        this.marginAxisY = this.height * 0.035


        this.fontSizeCustom = this.width / 1.3 < this.height ? this.width * 0.03 : this.height * 0.045
        this.fontSizeDataOnBar = this.settings.generalView.fontSizeDataOnBar ? this.settings.generalView.fontSizeDataOnBar : this.fontSizeCustom / 1.3

        this.fontSizeAxisX = this.settings.enableAxisX.fontSize ? this.settings.enableAxisX.fontSize : this.fontSizeCustom
        this.fontSizeAxisY = this.settings.enableAxisY.fontSize ? this.settings.enableAxisY.fontSize : this.fontSizeCustom
        this.fontSizeTitle = this.settings.title.fontSizeTitle ? this.settings.title.fontSizeTitle : this.fontSizeCustom * 1.5
        this.fontSizeLabel = this.settings.enableAxisY.fontSizeLabel ? this.settings.enableAxisY.fontSizeLabel : this.fontSizeCustom

        this.createTitle()
        this.setIndentation()

        this.heightYAxis = this.height - this.paddingTop - this.paddingBottom
        this.widthXAxis = this.width - this.paddingLeft - this.paddingRight

        this.createFilterCategory()

        this.createAxisAndDiagram()
    }

    private createFilterCategoryPanel(settings) {
        let maxHeight: number = settings.height * 5;
        let paddingTop: number = settings.fontSize * 1.7
        let paddingTextHorizontal: number = settings.width * 0.18
        let paddingTextVertical: number = maxHeight * 0.07
        let translateYSlicerGroup: number = settings.height + this.height * 0.01


        this.dropDownListDiv.style.position = 'absolute'
        this.dropDownListDiv.style.left = `${settings.translateXSlicer}px`
        this.dropDownListDiv.style.top = `${settings.translateYSlicer + translateYSlicerGroup}px`
        this.dropDownListDiv.style.width = `${settings.width}px`
        this.dropDownListDiv.style.height = `${maxHeight}px`

        this.dropDownListSvg
            .attr('id', 'svgSlicer')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', '100%')
            .attr('height', '100%')
            .attr("transform", "translate(" + 0 + "," + translateYSlicerGroup + ")")


        // this.dropDownListG.attr("transform", "translate(" + 0 + "," + translateYSlicerGroup + ")")



        this.dropDownListRect
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', settings.width)
            .attr('height', maxHeight)
            .style('fill', 'white')
            .attr('rx', 15)

        this.dropDownListTextGroup.attr('transform', `translate(${paddingTextHorizontal},${paddingTextVertical})`)


        let text = this.dropDownListTextGroup
            .selectAll('text')
            .data(this.dataPointsCategorySelectorAll)
        
        text.enter()
            .append('text')
            .merge(<any>text)
            .text(d => d.category)
            .attr('x', 0)
            .attr('y', (d, i) => paddingTop * i)
            .attr('alignment-baseline', 'hanging')
            .attr('text-anchor', 'start')
            .style('font-size', settings.fontSize)


        text.exit().remove()

        // const lastTextPositionY: number = parseInt($('svg #textGroup text').last().attr('y'))
        // if (lastTextPositionY > maxHeight) {
        //     this.divSlicer.style.overflowY = 'scroll'
        //     svgSlicer.attr('height', lastTextPositionY + paddingTextHorizontal + settings.fontSize / 2)
        // }



        // this.textCategory.on('click', (d) => {
        //     if (this.host.hostCapabilities.allowInteractions) {


        //         const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
        //         this.selectionManager
        //             .select(d.selectionId, isCtrlPressed)
        //             .then((ids: ISelectionId[]) => {
        //                 this.dataPointsCategorySelector = this.dataPointsCategorySelectorAll.filter(d => ids.find(i => i.equals(d.selectionId)))

        //                 this.update(this.options)
        //             });
        //         (<Event>getEvent()).stopPropagation();
        //     }
        // });


    }

    private setDataPoints() {
        if (this.dataPointsCategorySelector && this.dataPointsCategorySelector.length > 0) {
            this.viewModel.dataPoints = this.viewModel.dataPoints.filter(d => this.dataPointsCategorySelector.find(c => c.selectionId
                .equals(d.selectionId)))
        }
        else {
            this.dataPointsCategorySelectorAll = this.viewModel.dataPoints
        }
    }

    private setIndentation() {
        if (!this.settings.enableAxisX.show) {
            this.paddingBottom = 20
            this.xAxis.classed('remove', true)
        } else {
            this.xAxis.classed('remove', false)
        }

        if (!this.settings.enableAxisY.show) {
            this.yAxis.classed('remove', true)
            this.paddingLeft = 0
            this.paddingRight = 0
        } else {
            this.yAxis.classed('remove', false)
        }
        //Смещение диаграм
        this.barContainer.attr('transform', `translate(${this.paddingLeft}, ${this.paddingTop})`);
        //Смещение оси x
        this.xAxis.attr('transform', `translate(${this.paddingLeft}, ${this.height * 0.86})`);
        //Смещение оси y
        this.yAxis.attr('transform', `translate(${this.paddingLeft}, ${this.paddingTop})`)
    }


    private createFilterCategory() {
        let width = this.width * 0.16;
        let height = this.height * 0.08
        let fontSizeCustom = this.height < this.width ? this.height * 0.035 : this.width * 0.025
        let fontSize = !this.settings.selectionData && this.settings.selectionData.fontSize < fontSizeCustom ? this.settings.selectionData.fontSize : fontSizeCustom
        let translateXSlicer = this.width - this.paddingRight - width;
        let translateYSlicer = this.paddingTopInfoPanel

        const settings = {
            width, height, fontSize, translateXSlicer, translateYSlicer
        }

        this.filterCategoryG
            .attr("transform", "translate(" + translateXSlicer + "," + translateYSlicer + ")")

        this.filterCategoryRect
            .attr('id', 'select')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .attr('rx', 15)
            .style('fill', 'white')

        this.filterCategoryText
            .text(this.viewModel.categoryDisplayName)
            .attr('alignment-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .style('font-size', fontSize)
            .style('font-weight', 500)



        // if (this.slicerGroup) {
        //     this.slicerGroup.remove()
        //     this.slicerGroup = null
        //     this.divSlicer.remove()
        //     this.divSlicer = null
        //     this.categoryPanel()
        // }
        this.clickFilterCategory(settings)

    }
    private clickFilterCategory(settings) {
        this.filterCategoryG.on('click', (d) => {
            if (this.host.hostCapabilities.allowInteractions) {
                this.createFilterCategoryPanel(settings)

                // if (!this.slicerGroup) {
                //     this.categoryPanel()
                // } else {
                //     this.slicerGroup.remove()
                //     this.slicerGroup = null
                //     this.divSlicer.remove()
                //     this.divSlicer = null
                //     this.dataPointsCategorySelector = null
                // }
            }
        })
    }


    private createTitle() {
        if (this.settings.title.hide) {
            this.settings.title.text = null
        }
        const text = this.svg
            .selectAll('text.title')
            .data([this.settings.title.text])

        text.enter()
            .append('text')
            .merge(<any>text)
            .text(t => t)
            .classed('title', true)
            .attr("transform", `translate(${this.paddingLeft - 9}, ${this.paddingTopInfoPanel})`)
            .attr('alignment-baseline', 'hanging')
            .style('font-size', this.fontSizeTitle)

        text.exit().remove()
    }

    private createAxisAndDiagram() {

        //функция интерполяции оси Y
        let yScale = scaleLinear()
            .domain([this.viewModel.dataMax, 0])
            .range([0, this.heightYAxis - this.marginAxisY]);
        //функция интерполяции оси X
        let xScale = scaleBand()
            .domain(this.viewModel.dataPoints.map(d => d.category))
            .rangeRound([this.marginFirstBar, this.widthXAxis])
            .padding(0.6);

        //создаем оси
        let xAxis = axisBottom(xScale);
        let yAxis = axisLeft(yScale).ticks(4);  //ticks - задание количества делений, но движок d3 окончательно сам принимает решение
        this.xAxis.call(xAxis);
        this.yAxis.call(yAxis);
        this.xAxis.style('font-size', this.fontSizeAxisX)
        this.yAxis.style('font-size', this.fontSizeAxisY)


        //-----Название оси Y------
        this.yAxis
            .selectAll('text.labelY')
            .remove()



        if (this.settings.enableAxisY.label) {
            //Добавление названия оси Y
            this.yAxis
                .select('g.tick')
                .append('text')
                .classed('labelY', true)
                .attr('x', -9)  // значения на оси x имеют атрибут x = -9
                .attr('y', -this.fontSizeAxisY * 2)
                .attr('font-size', this.fontSizeLabel)
                .attr('alignment-baseline', 'baseline')
                .text(this.settings.enableAxisY.labelText)
        }


        // -----Горизонтальные линии----- 
        this.yAxis.selectAll(".tick line")
            .classed("grid-line", true)
            .attr("x1", -10)    // для того чтобы линия начиналась от начала значения на оси Y
            .attr("y1", -this.fontSizeAxisY)    // для того чтобы линия стояла над значением на оси Y
            .attr("x2", this.widthXAxis) // ширина линии равняется ширине оси Xs
            .attr("y2", -10);   // для того чтобы линия стояла над значением на оси Y

        this.yAxis.selectAll('.tick text').classed('textYAxis', true)





        //----- Создание градиента-----
        this.gradientBarSelection = this.defs
            .selectAll('linearGradient')
            .data(this.viewModel.dataPoints);


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

        if (this.settings.generalView.enableGradient) {
            gradientBarSelectionMerged
                .append('stop')
                .attr("offset", "100%") //Закончить этим цветом
                .attr("stop-color", "white")
        }
        this.gradientBarSelection.exit().remove();



        //-------- Создание диаграммы
        this.barSelection = this.barContainer
            .selectAll('.bar')
            .data(this.viewModel.dataPoints);

        const barSelectionMerged = this.barSelection
            .enter()
            .append('rect')
            .merge(<any>this.barSelection)
            .classed('bar', true)
            .attr('rx', 7)
            .attr("width", xScale.bandwidth())
            .attr("height", d => this.heightYAxis - this.marginAxisY - yScale(<number>d.value))
            .attr("y", d => yScale(<number>d.value))
            .attr("x", d => xScale(d.category))
            .attr("fill", (dataPoint: BarChartDataPoint, i: number) => `url(#Gradient${i + 1})`)

        this.barSelection.exit().remove();


        //------ Добавление числа над диаграммой
        let dataBarSelectionMerged;
        if (this.settings.generalView.dataOnBar) {
            this.dataBarSelection = this.barContainer
                .selectAll('.barDataValue')
                .data(this.viewModel.dataPoints);


            dataBarSelectionMerged = this.dataBarSelection
                .enter()
                .append('text')
                .classed('barDataValue', true)
                .merge(<any>this.dataBarSelection);


            dataBarSelectionMerged
                .text((d: BarChartDataPoint) => Math.round(<number>d.value))
                .attr("y", (d: BarChartDataPoint) => yScale(<number>d.value) - this.fontSizeDataOnBar / 2)
                .attr("x", (d: BarChartDataPoint) => xScale(d.category) + xScale.bandwidth() / 2)
                .style('font-size', this.fontSizeDataOnBar)
        } else {
            this.barContainer.selectAll('text').remove()
        }
        this.dataBarSelection.exit().remove();

        this.bars = this.barContainer.selectAll('rect.bar')
        this.dataOnBars = this.barContainer.selectAll('text.barDataValue')
        this.axisX = this.xAxis.selectAll('g .tick text')


        this.clickDiagram()
    }

    private clickDiagram() {
        this.bars?.on('click', (d: any) => {
            if (this.host.hostCapabilities.allowInteractions) {
                const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
                this.selectionManager
                    .select(d.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.clickDiagramHandler(ids)
                    });
                (<Event>getEvent()).stopPropagation();
            }
        });
    }


    private clickDiagramHandler(ids: ISelectionId[]) {
        const opacityGeneral: number = 1
        const opacitySelected: number = opacityGeneral / 2
        if (ids.length === 0) {
            this.bars
                .style("fill-opacity", opacityGeneral)
                .style("stroke-opacity", opacityGeneral);
            this.dataOnBars
                .style("fill-opacity", opacityGeneral)
                .style("stroke-opacity", opacityGeneral);
            this.axisX
                .style("fill-opacity", opacityGeneral)
                .style("stroke-opacity", opacityGeneral);
            return
        }

        this.bars.each((d: BarChartDataPoint, index, nodeList: d3.BaseType[]) => {
            if (ids.find(i => i.equals(d.selectionId))) {
                this.bars.filter((d, i) => i === index)
                    .style("fill-opacity", opacityGeneral)
                    .style("stroke-opacity", opacityGeneral);

                this.dataOnBars.filter((d, i) => i === index)
                    .style("fill-opacity", opacityGeneral)
                    .style("stroke-opacity", opacityGeneral);

                this.axisX.filter((d, i) => i === index)
                    .style("fill-opacity", opacityGeneral)
                    .style("stroke-opacity", opacityGeneral);

            }
            else {
                this.bars.filter((d, i) => i === index)
                    .style("fill-opacity", opacitySelected)
                    .style("stroke-opacity", opacitySelected);

                this.dataOnBars.filter((d, i) => i === index)
                    .style("fill-opacity", opacitySelected)
                    .style("stroke-opacity", opacitySelected);
                this.axisX.filter((d, i) => i === index)
                    .style("fill-opacity", opacitySelected)
                    .style("stroke-opacity", opacitySelected);
            }

        });
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];
        if (!this.settings ||
            !this.settings.enableAxisX ||
            !this.settings.enableAxisY ||
            !this.viewModel.dataPoints) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'title':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        text: this.settings.title.text,
                        hide: this.settings.title.hide,
                        fontSizeTitle: this.settings.title.fontSizeTitle
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
                        show: this.settings.enableAxisX.show,
                        fontSize: this.settings.enableAxisX.fontSize
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
                        show: this.settings.enableAxisY.show,
                        label: this.settings.enableAxisY.label,
                        fontSize: this.settings.enableAxisY.fontSize,
                        fontSizeLabel: this.settings.enableAxisY.fontSizeLabel,
                        labelText: this.settings.enableAxisY.labelText
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
                        dataOnBar: this.settings.generalView.dataOnBar,
                        enableGradient: this.settings.generalView.enableGradient,
                        fontSizeDataOnBar: this.settings.generalView.fontSizeDataOnBar
                    },
                    validValues: {
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
                        fontSize: this.settings.selectionData.fontSize,
                        color: this.settings.selectionData.color
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