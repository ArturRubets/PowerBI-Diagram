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
const getEvent = () => require("d3-selection").event;

interface BarChartDataPoint {
    value: number;
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
        labelText: "Units",
        line:true
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
        enable: true
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
    private bar: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private element: HTMLElement;
    private options: VisualUpdateOptions
    private bars: Selection<any>
    private dataOnBars: Selection<any>
    private axisX: Selection<any>
    private title: Selection<any>
    private xScale: d3.ScaleBand<any>
    private yScale: d3.ScaleLinear<any, any, any>
    private labelY: Selection<any>
    private filterCategoryG: Selection<SVGElement>
    private filterCategoryRect: Selection<SVGElement>
    private filterCategoryText: Selection<SVGElement>
    private dropDownListDiv: HTMLElement
    private dropDownListSvg: Selection<any>
    private dropDownListSvgRect: Selection<any>
    private dropDownListDivInner: HTMLElement
    private dropDownListDivInnerSvg: Selection<any>
    private dropDownListDivInnerSvgTextGroup: Selection<any>
    private dropDownListText: Selection<any>
    private dropDownListIds: ISelectionId[]
    private dataPointsAll: BarChartDataPoint[]
    private arrowPath: Selection<any>
    private arrowG: Selection<any>

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

        this.title = this.svg.append('text')



        this.filterCategoryG = this.svg.append('g').classed('filterCategory', true)
        this.filterCategoryRect = this.filterCategoryG.append('rect')
        this.filterCategoryText = this.filterCategoryG.append('text')
        this.dropDownListDiv = document.createElement('div')
        this.element.appendChild(this.dropDownListDiv)
        this.dropDownListSvg = d3Select(this.dropDownListDiv).append('svg')
        this.dropDownListSvgRect = this.dropDownListSvg.append('rect')
        this.dropDownListDivInner = document.createElement('div')
        this.dropDownListDivInner.classList.add('scrollbar')
        this.dropDownListDiv.appendChild(this.dropDownListDivInner)
        this.dropDownListDivInnerSvg = d3Select(this.dropDownListDivInner).append('svg')
        this.dropDownListDivInnerSvgTextGroup = this.dropDownListDivInnerSvg.append('g')
        this.arrowG = this.filterCategoryG.append('g')
        this.arrowPath = this.arrowG.append('path')
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
        
        this.setIndentation()

        this.createFilterCategory(this.settings.selectionData.enable)     
        this.createTitle()
        this.createAxis(this.settings.enableAxisY.line)
        this.nameAxisY(this.settings.enableAxisY.label)
        this.createGradient(this.settings.generalView.enableGradient)
        this.createDiagram()
        this.createDataOnBars(this.settings.generalView.dataOnBar)
    }

    private setDataPoints() {
        if (this.dropDownListIds?.length > 0) {
            this.viewModel.dataPoints = this.dataPointsAll.filter(d => this.dropDownListIds.find(id => id.equals(d.selectionId)))
            this.viewModel.dataMax = Math.max(...this.viewModel.dataPoints.map(d => d.value))
        }
        else {
            this.dataPointsAll = this.viewModel.dataPoints
        }
    }

    private createTitle() {
        if (this.settings.title.hide) {
            this.title.html('')
        } else {
            this.title
                .text(this.settings.title.text)
                .classed('title', true)
                .attr("transform", `translate(${this.paddingLeft - 9}, ${this.paddingTopInfoPanel})`)
                .attr('alignment-baseline', 'hanging')
                .style('font-size', this.fontSizeTitle)
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

        this.heightYAxis = this.height - this.paddingTop - this.paddingBottom
        this.widthXAxis = this.width - this.paddingLeft - this.paddingRight
    }

    private createFilterCategory(enable) {
        if (enable) {
            this.dropDownListDiv.style.display = 'block'
            this.filterCategoryG.style('display', 'inline')
            
        } else {
            this.filterCategoryG.style('display', 'none')
            this.dropDownListDiv.style.display = 'none'
            return
        }

        let width = this.width * 0.16;
        let height = this.height * 0.08

        let fontSizeCustom = this.height >= this.width * 0.6 ? this.fontSizeCustom * 0.8 : this.fontSizeCustom
        let fontSize = this.settings.selectionData.fontSize && this.settings.selectionData.fontSize < fontSizeCustom ? this.settings.selectionData.fontSize : fontSizeCustom
        let translateXSlicer = this.width - this.paddingRight - width;
        let translateYSlicer = this.paddingTopInfoPanel
        let paddingHorizontal = width * 0.1

        this.filterCategoryG
            .attr("transform", "translate(" + translateXSlicer + "," + translateYSlicer + ")")

        this.filterCategoryRect
            .attr('id', 'select')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .attr('rx', width / 2 > height ? width * 0.05 : Math.max(width, height) * 0.1)
            .style('fill', 'white')

        this.filterCategoryText
            .text(this.viewModel.categoryDisplayName)
            .attr('alignment-baseline', 'middle')
            .attr('text-anchor', 'start')
            .attr('x', paddingHorizontal)
            .attr('y', height / 2)
            .style('font-size', fontSize)
            .style('font-weight', 500)

        const heightArrow = this.filterCategoryText.node().getBBox().height / 4
        const widthArrow = this.filterCategoryText.node().getBBox().width * 0.14
        const settings = {
            width, height, fontSize, translateXSlicer, translateYSlicer, paddingHorizontal, widthArrow, heightArrow
        }
        this.displayArrow(settings)
        this.displayFilterCategory(settings)
        this.clickFilterCategory(settings)
    }

    private displayArrow(settings) {
        this.arrowG.attr('transform', `translate(${settings.width - settings.paddingHorizontal}, ${settings.height / 2})`)
        this.arrowPath
            .attr('d', `
                M 0 0
                l ${-settings.widthArrow / 2} ${-settings.heightArrow}
                l ${-settings.widthArrow / 2} ${settings.heightArrow}           
            `)
            .style('fill', 'none')
            .style('stroke-width', settings.fontSizeCustom * 0.1)
            .style('stroke', '#474747')
    }

    private rotateArrow(settings, angle) {
        this.arrowPath.attr('transform', `translate(0,${angle === -180 ? -settings.height * 0.1 : 0}) rotate(${angle}, ${-settings.widthArrow / 2},0)`)
    }

    private clickFilterCategory(settings) {
        this.filterCategoryG.on('click', (d) => {
            if (this.host.hostCapabilities.allowInteractions) {
                if (this.filterCategoryG.classed('clicked')) {
                    this.filterCategoryG.classed('clicked', false)
                    this.rotateArrow(settings, 0)

                } else {
                    this.filterCategoryG.classed('clicked', true)
                    this.rotateArrow(settings, -180)
                }
                this.displayFilterCategory(settings)
            }
        })
    }

    private displayFilterCategory(settings) {
        if (this.filterCategoryG.classed('clicked')) {
            this.dropDownListDiv.style.display = 'block'
            this.createFilterCategoryPanel(settings)

        } else {
            this.dropDownListDiv.style.display = 'none'
        }
    }

    private createFilterCategoryPanel(settings) {
        let maxHeight: number = settings.height * 5.5;
        let paddingTop: number = settings.fontSize * 1.8
        let paddingTextVertical: number = settings.fontSize
        let translateYSlicerGroup: number = settings.height + this.height * 0.013


        this.dropDownListDiv.style.position = 'absolute'
        this.dropDownListDiv.style.left = `${settings.translateXSlicer}px`
        this.dropDownListDiv.style.top = `${settings.translateYSlicer + translateYSlicerGroup}px`
        this.dropDownListDiv.style.width = `${settings.width}px`
        this.dropDownListDiv.style.height = `${maxHeight}px`

        this.dropDownListSvg
            .attr('id', 'dropDownListSvg')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', '100%')
            .attr('height', '100%')

        this.dropDownListSvgRect
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', settings.width)
            .attr('height', maxHeight)
            .style('fill', 'white')
            .attr('rx', this.filterCategoryRect.attr('rx'))


        this.dropDownListDivInner.style.position = 'absolute'
        this.dropDownListDivInner.style.left = `0px`
        this.dropDownListDivInner.style.top = `0px`
        this.dropDownListDivInner.style.width = `${settings.width}px`
        this.dropDownListDivInner.style.height = `${maxHeight}px`
        this.dropDownListDivInner.style.overflowY = 'hidden'


        this.dropDownListDivInnerSvg
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', '100%')
            .attr('height', '100%')

        this.dropDownListDivInnerSvgTextGroup.attr('transform', `translate(${settings.paddingHorizontal},${paddingTextVertical})`)

        const text = this.dropDownListDivInnerSvgTextGroup
            .selectAll('text')
            .data(this.dataPointsAll)

        this.dropDownListText = text.enter()
            .append('text')
            .merge(<any>text)
            .text(d => d.category)
            .attr('x', 0)
            .attr('y', (d, i) => paddingTop * i)
            .attr('alignment-baseline', 'hanging')
            .attr('text-anchor', 'start')
            .style('font-size', settings.fontSize)

        text.exit().remove()

        //Установка высоты панели фильтров, в зависимости от колчст значений 
        const heightPanelActual: number = this.dropDownListDivInnerSvgTextGroup.node().getBBox().height + paddingTextVertical * 1.5
       


        if (heightPanelActual > maxHeight) {
            this.dropDownListDivInner.style.overflowY = 'scroll'  
            this.dropDownListDivInnerSvg.attr('height', heightPanelActual)          
        } else{
            this.dropDownListSvg.attr('height',heightPanelActual)
            this.dropDownListSvgRect.attr('height',heightPanelActual)
            this.dropDownListDivInner.style.height = `${heightPanelActual}px`        
            this.dropDownListDiv.style.height = `${heightPanelActual}px`
            this.dropDownListDivInnerSvg.attr('height', heightPanelActual)          
        }

        this.createDotsOnCategoryPanel(this.dropDownListIds, settings)
        this.clickFilterCategoryPanel(settings)
    }

    private clickFilterCategoryPanel(settings) {
        this.dropDownListText.on('click', (d) => {
            if (this.host.hostCapabilities.allowInteractions) {
                const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
                this.selectionManager
                    .select(d.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.createDotsOnCategoryPanel(ids, settings)
                        this.clickFilterCategoryPanelHandler(ids)
                    });
                (<Event>getEvent()).stopPropagation();
            }
        });
    }

    private createDotsOnCategoryPanel(ids: ISelectionId[], settings) {
        if (!ids) {
            return
        }
        const textNodes = this.dropDownListText.nodes().filter(d => ids.find(i => i.equals((<BarChartDataPoint>d3Select(d).datum()).selectionId)))

        const circle = this.dropDownListDivInnerSvgTextGroup
            .selectAll('circle')
            .data(textNodes)

        circle.enter()
            .append('circle')
            .merge(<any>circle)
            .attr('cx', d => d.getBBox().x + d.getBBox().width + settings.width * 0.08)
            .attr('cy', d => d.getBBox().y + d.getBBox().height / 1.6)
            .attr('r', settings.fontSize / 4)
            .style('fill', d => (<BarChartDataPoint>d3Select(d).datum()).color)


        circle.exit().remove()
    }

    private clickFilterCategoryPanelHandler(ids: ISelectionId[]) {
        this.dropDownListIds = ids
        this.update(this.options)
    }

    private createAxis(IsHorizontalLine) {
        //функция интерполяции оси Y
        this.yScale = scaleLinear()
            .domain([this.viewModel.dataMax, 0])
            .range([0, this.heightYAxis - this.marginAxisY]);
        //функция интерполяции оси X
        this.xScale = scaleBand()
            .domain(this.viewModel.dataPoints.map(d => d.category))
            .rangeRound([this.marginFirstBar, this.widthXAxis])
            .padding(0.6);

        //создаем оси
        let xAxis = axisBottom(this.xScale);
        let yAxis = axisLeft(this.yScale).ticks(4);  //ticks - задание количества делений, но движок d3 окончательно сам принимает решение
        this.xAxis.call(xAxis);
        this.yAxis.call(yAxis);
        this.xAxis.style('font-size', this.fontSizeAxisX)
        this.yAxis.style('font-size', this.fontSizeAxisY)
        this.axisX = this.xAxis.selectAll('g .tick text')


        // -----Горизонтальные линии----- 
        if (IsHorizontalLine) {
            this.yAxis.selectAll(".tick line")
                .classed("grid-line", true)
                .attr("x1", -10)    // для того чтобы линия начиналась от начала значения на оси Y
                .attr("y1", -this.fontSizeAxisY)    // для того чтобы линия стояла над значением на оси Y
                .attr("x2", this.widthXAxis) // ширина линии равняется ширине оси Xs
                .attr("y2", -10);   // для того чтобы линия стояла над значением на оси Y
        }

        this.yAxis.selectAll('.tick text').classed('textYAxis', true)
    }

    private nameAxisY(IsShow) {
        if (IsShow) {
            //Добавление названия оси Y
            this.labelY?.remove()
            this.labelY = this.yAxis
                .select('g.tick')
                .append('text')
                .classed('labelY', true)
                .attr('x', -9)  // значения на оси x имеют атрибут x = -9
                .attr('y', -this.fontSizeAxisY * 2)
                .attr('font-size', this.fontSizeLabel)
                .attr('alignment-baseline', 'baseline')
                .text(this.settings.enableAxisY.labelText)
        } else{
            this.labelY.remove()
        }
    }

    private createGradient(enableGradient) {
        //----- Создание градиента-----
        let gradientBarSelection = this.defs
            .selectAll('linearGradient')
            .data(this.viewModel.dataPoints);


        const gradientBarSelectionMerged = gradientBarSelection
            .enter()
            .append("linearGradient")
            .merge(<any>gradientBarSelection)
            .attr("id", (dataPoint, i: number) => `Gradient${i + 1}`)  //Индекс для того чтобы для каждого bar был свой элемент linearGradient нужно прописать айди уникальный
            .attr("x1", "0")    //Координаты заливки чтобы залить вертикально сверху вниз
            .attr("x2", "0")
            .attr("y1", "0")
            .attr("y2", "1")


        gradientBarSelectionMerged.selectAll('stop').remove()   //При обновлении удаляем элементы stop и дальше заменяем их обновленными

        gradientBarSelectionMerged
            .append("stop")
            .attr("offset", "0%")   //Начать с этого цвета 
            .attr("stop-color", (dataPoint: BarChartDataPoint) => dataPoint.color)

        if (enableGradient) {
            gradientBarSelectionMerged
                .append('stop')
                .attr("offset", "95%") //Закончить этим цветом
                .attr("stop-color", "white")
        }

        gradientBarSelection.exit().remove();
    }

    private createDiagram() {
        this.bar = this.barContainer
            .selectAll('.bar')
            .data(this.viewModel.dataPoints);

        this.bars = this.bar
            .enter()
            .append('rect')
            .merge(<any>this.bar)
            .classed('bar', true)
            .attr('rx', Math.min(10, Math.max(4, this.xScale.bandwidth() * 0.2)))
            .attr("width", this.xScale.bandwidth())
            .attr("height", d => this.heightYAxis - this.marginAxisY - this.yScale(<number>d.value))
            .attr("y", d => this.yScale(<number>d.value))
            .attr("x", d => this.xScale(d.category))
            .attr("fill", (dataPoint, i: number) => `url(#Gradient${i + 1})`)

        this.bar.exit().remove();

        this.clickDiagram()
    }

    private createDataOnBars(enable) {
        //------ Добавление числа над диаграммой
        let barDataValue = this.barContainer
            .selectAll('.barDataValue')
            .data(this.viewModel.dataPoints);

        this.dataOnBars = barDataValue
            .enter()
            .append('text')
            .classed('barDataValue', true)
            .merge(<any>barDataValue)
            .text((d: BarChartDataPoint) => Math.round(<number>d.value))
            .attr("y", (d: BarChartDataPoint) => this.yScale(<number>d.value) - this.fontSizeDataOnBar / 2)
            .attr("x", (d: BarChartDataPoint) => this.xScale(d.category) + this.xScale.bandwidth() / 2)
            .style('font-size', this.fontSizeDataOnBar)

        barDataValue.exit().remove();

        if(!enable)
            this.dataOnBars?.html('')
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
                ?.style("fill-opacity", opacityGeneral)
                .style("stroke-opacity", opacityGeneral);
            this.dataOnBars
                ?.style("fill-opacity", opacityGeneral)
                .style("stroke-opacity", opacityGeneral);
            this.axisX
                ?.style("fill-opacity", opacityGeneral)
                .style("stroke-opacity", opacityGeneral);
            return
        }

        this.bars.each((d: BarChartDataPoint, index, nodeList: d3.BaseType[]) => {
            if (ids.find(i => i.equals(d.selectionId))) {
                this.bars?.filter((d, i) => i === index)
                    .style("fill-opacity", opacityGeneral)
                    .style("stroke-opacity", opacityGeneral);

                this.dataOnBars?.filter((d, i) => i === index)
                    .style("fill-opacity", opacityGeneral)
                    .style("stroke-opacity", opacityGeneral);

                this.axisX?.filter((d, i) => i === index)
                    .style("fill-opacity", opacityGeneral)
                    .style("stroke-opacity", opacityGeneral);

            }
            else {
                this.bars?.filter((d, i) => i === index)
                    .style("fill-opacity", opacitySelected)
                    .style("stroke-opacity", opacitySelected);

                this.dataOnBars?.filter((d, i) => i === index)
                    .style("fill-opacity", opacitySelected)
                    .style("stroke-opacity", opacitySelected);
                this.axisX?.filter((d, i) => i === index)
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
                        labelText: this.settings.enableAxisY.labelText,
                        line:  this.settings.enableAxisY.line,
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
                        enable: this.settings.selectionData.enable
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
        || !dataViews[0].categorical.values[0].values
        || !(typeof dataViews[0].categorical.values[0].values[0] === 'number')
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
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "selectionData", propertyName: "fontSize",
            }, defaultSettings.selectionData.fontSize),
            enable: dataViewObjects.getValue(objects, {
                objectName: "selectionData", propertyName: "enable",
            }, defaultSettings.selectionData.enable),
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
            line: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "line",
            }, defaultSettings.enableAxisY.line),
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
            value: <number>dataValue.values[i],
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