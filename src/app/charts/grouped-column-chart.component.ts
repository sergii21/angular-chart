import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { D3, D3Service, Selection } from 'd3-ng2-service';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-grouped-column-chart',
  template: `
    <div #container>
      <div class="chart-tooltip"></div>
    </div>`,
  styleUrls: ['./grouped-column-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupedColumnChartComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() chartConfig: any;

  @Output() barClick: EventEmitter<any> = new EventEmitter();

  @ViewChild('container') element: ElementRef;

  private svg;
  private chartContainer: HTMLElement;
  private d3: D3; // <-- Define the private member which will hold the d3 reference
  private columnLayer: Selection<SVGElement, {}, HTMLElement, any>;
  private axisLayer: Selection<SVGElement, {}, HTMLElement, any>;
  private legendLayer: Selection<SVGElement, {}, HTMLElement, any>;
  private countLayer: Selection<SVGElement, {}, HTMLElement, any>;
  private tooltip: Selection<any, any, any, any>;
  private columnsData: Array<any>;
  private legendData: Array<any>;
  private xScale: any;
  private xInScale: any;
  private yScale: any;
  private columnLayerHeight: number;
  private subscriptions = [];
  private t: any; // transition
  private maxValue: number;
  private totalLegendHeight = 0; // get group height
  private totalLabelHeight: number; // get group height
  private totalCountHeight: number; // get group height

  // configurations
  defaultOptions = {
    width: 800,
    height: 400,
    barWidth: 60,
    gapBetweenBars: 20,
    gapBetweenGroups: 56,
    gapBetweenLegendAndColumns: 20,
    labelTopPadding: 20,
    legendHeight: 20,
    legendWidth: 20,
    countRectHeight: 20,
    gapBetweenLegend: 20,
    gapBetweenTextAndRectLegend: 6,
    gapBetweenColumnAndCount: 15,
    colorCountRect: '#f2f2f2',
    drawLegend: true,
    showPercentage: true
  };
  options: any;

  get groupsNumber() {
    return this.options.labels.length;
  }

  get seriesNumber() {
    return this.options.series.length;
  }

  constructor(d3Service: D3Service) {
    this.d3 = d3Service.getD3(); // <-- obtain the d3 object from the D3 Service
  }

  ngOnInit() {
    this.subscriptions.push(fromEvent(window, 'resize').pipe(debounceTime(100)).subscribe(() => this.populate()));
  }

  /**
   * We request angular for the element reference
   * and then we create a D3 Wrapper for our host element
   * also create chart
   **/
  ngAfterViewInit() {
    this.chartContainer = this.element.nativeElement;
  }

  /**
   * Everythime the @Input is updated, we rebuild the chart
   **/
  ngOnChanges(changes): void {
    if (changes['chartConfig'] && this.chartConfig) {
      this.populate();
    }
  }

  /**
   * Unsubscribe event
   */
  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  /**
   * Will call all necessary method to draw/redraw d3 chart
   */
  populate() {
    if (!this.chartConfig) {
      return;
    }
    this.setup();
    this.buildSVG();
    if (this.options.drawLegend) {
      this.drawLegend();
    }
    this.drawAxisX();
    this.drawCount();
    this.drawColumns();
  }

  /**
   * Basically we get the dom element size and build the container configs
   * also we create the xScale and yScale ranges depending on calculations
   **/
  private setup(): void {
    const d3 = this.d3;

    this.t = d3.transition(null).duration(500).ease(d3.easeLinear);

    this.options = Object.assign({}, this.defaultOptions, this.chartConfig);
    this.buildDataSet();

    const parentContainerRect = this.d3.select(this.element.nativeElement).node().getBoundingClientRect();
    this.options.width = this.d3.min([this.options.width, parentContainerRect.width]);

    if (this.options.width > this.chartContainer.clientWidth) {
      this.options.width = this.chartContainer.clientWidth;
    }
    if (!this.options.drawLegend) {
      this.options.legendHeight = 0;
    }

    this.xScale = d3
      .scaleBand()
      .domain(this.options.labels)
      .range([0, this.options.width])
      .paddingInner(0.5)
      .paddingOuter(0.3);

    this.xInScale = d3
      .scaleBand()
      .domain(d3.range(this.seriesNumber).map(d => d + ''))
      .range([0, this.xScale.bandwidth()])
      .paddingInner(0.2);
  }

  calculateYScale() {
    const o = this.options;
    const d3 = this.d3;
    this.yScale = d3
      .scaleLinear()
      .domain([0, this.maxValue])
      .range([this.columnLayerHeight, o.gapBetweenColumnAndCount + o.countRectHeight]);
  }

  /**
   * Creates a flattened array includin bar data from all series
   */
  buildDataSet() {
    this.maxValue = 0;
    let seriesLength = this.chartConfig.series.length;

    this.columnsData = Array.apply(null, Array(this.groupsNumber)).map(function () {
      return {data: []};
    });
    const legendData = (this.legendData = []);

    for (let i = 0; i < this.groupsNumber; i++) {
      this.chartConfig.series.forEach((s, index) => {
        if (this.columnsData[i].data.length < seriesLength) {
          const value = s.data[i].value;
          if (this.maxValue < value) {
            this.maxValue = value;
          }
          this.columnsData[i].data.push({
            ser: index,
            striped: false,
            value: value,
            color: s.data[i].color,
            id: s.data[i].id
          });

          if (!('total' in this.chartConfig.series[index])) {
            this.chartConfig.series[index].total = 0;
          }
          this.chartConfig.series[index].total += value;

          if (s.striped) {
            ++seriesLength;
            this.columnsData[i].data.push({
              ser: index,
              striped: true,
              value: value,
              color: s.data[i].color,
              id: s.data[i].id
            });
          }
        }
      });
    }

    this.chartConfig.series.forEach((s, index) => {
      if (this.options.drawLegend) {
        legendData.push({
          striped: false,
          color: s.color,
          legend: s.legend,
          ser: index
        });

        if (s.striped) {
          legendData.push({
            striped: true,
            color: s.color,
            legend: s.legend,
            ser: index
          });
        }
      }
    });
  }

  /**
   * We can now build our SVG element using the configurations we created
   **/
  private buildSVG(): void {
    const o = this.options;

    if (!this.svg) {
      const d3 = this.d3;
      const svg = (this.svg = d3
        .select(this.element.nativeElement)
        .append('svg')
        .attr('width', o.width)
        .attr('height', o.height));

      this.columnLayer = svg.append('g').classed('columns', true);
      this.axisLayer = svg.append('g').classed('x-axis', true);
      this.legendLayer = svg.append('g').classed('legends', true);
      this.countLayer = svg.append('g').classed('counts', true);
      this.addPatterns();
      this.tooltip = d3.select(this.element.nativeElement).select('.chart-tooltip').style('background', o.colorCountRect);
    }

    this.svg.attr('width', o.width);
  }

  private addPatterns() {
    // Pattern to draw striped shapes
    const def = this.svg.append('defs');

    def
      .append('pattern')
      .attrs({
        id: 'striped-bar-pattern',
        width: '12',
        height: '8',
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)'
      })
      .append('rect')
      .attrs({width: '6', height: '8', transform: 'translate(0,0)', fill: '#ffffff'});
    //
    // // Pattern to draw striped shapes
    def
      .append('pattern')
      .attrs({
        id: 'striped_legend_pattern',
        width: '9',
        height: '8',
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)'
      })
      .append('rect')
      .attrs({width: '4', height: '8', transform: 'translate(0,0)', fill: '#ffffff'});
  }

  drawLegend() {
    const o = this.options;
    const series = this.seriesNumber;
    const d3 = this.d3;
    const options = this.options;
    const height = options.height - options.legendHeight;
    const widths = [];
    const allGapsWidth = o.legendWidth + o.gapBetweenTextAndRectLegend + o.gapBetweenLegend;
    const legendXScale = [];
    const calcXOffset = index => {
      return legendXScale[index];
    };

    const legendGroups = this.legendLayer.selectAll('g').data(this.legendData);

    const newLegendGroups = legendGroups.enter().append('g');

    const legends = legendGroups.merge(newLegendGroups);
    const rects = legends.selectAll('rect').data((d: any) => [d]);
    const texts = legends.selectAll('text').data((d: any) => [d]);

    rects
      .enter()
      .append('rect')
      .attr('width', o.legendWidth)
      .attr('height', o.legendHeight)
      .attr('opacity', d => (d.striped ? 0.3 : 1))
      .attr('fill', d => (d.striped ? 'url(#striped_legend_pattern)' : d.color));

    const newTexts = texts.enter().append('text').attr('fill', '#53565a');

    texts
      .merge(newTexts)
      .text(d => (d.striped ? '' : d.legend))
      .attr('x', o.legendWidth + o.gapBetweenTextAndRectLegend)
      .attr('y', function (d) {
        const rect = (d3.select(this).node() as any).getBBox();
        if (!d.striped) {
          const width = rect.width;
          const xScale = !d.ser ? 0 : legendXScale[d.ser - 1] + width + allGapsWidth;

          widths.push(width);
          legendXScale.push(xScale);
        }
        return o.legendHeight - rect.height * 0.3;
      });

    const allWidth =
      widths.reduce((x, y) => x + y) +
      o.legendWidth * series +
      o.gapBetweenTextAndRectLegend * series +
      o.gapBetweenLegend * (series - 1);

    if (!texts.size()) {
      this.legendLayer.attr('transform', () => `translate(0, ${height})`);
    }
    this.legendLayer.transition(this.t).attr('transform', () => `translate(${(o.width - allWidth) * 0.5}, ${height})`);

    legendGroups.merge(newLegendGroups).attr('transform', (d, i) => `translate(${calcXOffset(d.ser)}, 0)`);

    this.totalLegendHeight = (this.legendLayer.node() as any).getBBox().height + options.gapBetweenLegendAndColumns;
  }

  private drawAxisX() {
    const isEnter = !this.axisLayer.selectAll('g').size();
    const xAxis = this.d3.axisBottom(this.xScale).tickSize(0).tickPadding(this.options.labelTopPadding);

    if (isEnter) {
      this.axisLayer.call(xAxis).attr('font-size', 'inherit').selectAll('line, path').style('stroke', '#bbbcbc');
    } else {
      this.axisLayer.attr('transform', () => `translate(0, ${this.columnLayerHeight})`).call(xAxis).transition(this.t);
    }
    this.totalLabelHeight = (this.axisLayer.node() as any).getBBox().height;
    this.columnLayerHeight = this.options.height - this.totalLabelHeight - this.totalLegendHeight;

    if (isEnter) {
      this.axisLayer.attr('transform', () => `translate(0, ${this.columnLayerHeight})`);
    }
  }

  private drawCount() {
    const countGroup = this.countLayer.selectAll('.group-count').data(this.columnsData);
    const o = this.options;
    const d3 = this.d3;
    const t = this.t;
    const xScale = this.xScale;
    const xInScale = this.xInScale;
    const setWidth = (d: any) => (d.striped ? 0 : getWidth(d));
    const getWidth = d => d.value.toString().length * 6 + 20;
    const newCountGroup = countGroup.enter().append('g').classed('group-count', true);

    countGroup.merge(newCountGroup).attr('transform', function (d: any, i) {
      return 'translate(' + [xScale(o.labels[i]), 0] + ')';
    });

    const groups = countGroup.merge(newCountGroup);
    const rect = groups.selectAll('rect').data(d => d.data);
    const text = groups.selectAll('text').data(d => d.data);

    const newRect = rect
      .enter()
      .append('rect')
      .attr('rx', 10)
      .attr('fill', o.colorCountRect)
      .attr('width', setWidth)
      .attr('height', o.countRectHeight);

    const newText = text.enter().append('text');

    text.merge(newText).text((d: any) => (d.striped ? '' : d.value));

    this.calculateYScale();

    const yScale = this.yScale;
    const translateText = function (selection) {
      selection.attr('transform', function (d: any) {
        const textRect = (d3.select(this).node() as any).getBBox();
        return `translate(${xInScale(d.ser) + xInScale.bandwidth() * 0.5 - textRect.width * 0.5},
             ${yScale(d.value) - o.gapBetweenColumnAndCount})`;
      });
    };
    const translateRect = function (selection) {
      selection.attr('transform', function (d: any) {
        return `translate(${xInScale(d.ser) + xInScale.bandwidth() * 0.5 - getWidth(d) * 0.5},
             ${yScale(d.value) - o.gapBetweenColumnAndCount - o.countRectHeight * 0.75})`;
      });
    };

    newText.call(translateText);
    newRect.call(translateRect);

    text.transition(t).call(translateText);

    rect.transition(t).attr('width', setWidth).call(translateRect);
  }

  private drawColumns() {
    const o = this.options;
    const d3 = this.d3;
    const height = this.columnLayerHeight;
    const xScale = this.xScale;
    const xInScale = this.xInScale;
    const yScale = this.yScale;
    const tooltip = this.tooltip;
    const groupColumns = this.columnLayer.selectAll('.group-column').data(this.columnsData);
    const t = this.t;
    const series = this.chartConfig.series;

    const newGroupColumns = groupColumns.enter().append('g').classed('group-column', true);

    groupColumns.merge(newGroupColumns).attr('transform', function (d: any, i) {
      return 'translate(' + [xScale(o.labels[i]), 0] + ')';
    });

    const columns = groupColumns.merge(newGroupColumns).selectAll('.column').data(d => d.data);
    const controller = this;
    const newColumns = columns
      .enter()
      .append('rect')
      .attr('height', 0)
      .attr('cursor', 'pointer')
      .classed('column', true)
      .attr('transform', (d: any) => `translate(${xInScale(d.ser)}, ${height})`)
      .attr('fill', (d: any) => (d.striped ? 'url(#striped-bar-pattern)' : d.color))
      .style('opacity', (d: any) => (d.striped ? 0.2 : 1));

    columns
      .merge(newColumns)
      // TODO: fix stripped column highlighting
      // .on('mouseover', function() {
      //   d3.select(this).attr('fill', function(): any {
      //     return d3.rgb(d3.select(this).style('fill')).darker(0.5);
      //   });
      // })
      .on('mouseout', function (d) {
        // d3.select(this).attr('fill', function(d: any): any {
        //   return d.striped ? 'url(#striped-bar-pattern)' : d3.rgb(d3.select(this).style('fill')).brighter(0.5);
        // });
        (this as any)._clicked = false;
        tooltip.style('display', function () {
          return 'none';
        });
      })
      .on('mousemove', function (d: any) {
        if (o.showPercentage && !(this as any)._clicked) {
          const event = d3.event;
          tooltip
            .style('left', event.offsetX + 20 + 'px')
            .style('top', event.offsetY + 25 + 'px')
            .style('display', 'inline-block')
            .text(function () {
              return (d.value * 100 / series[d.ser].total).toFixed(1) + '%';
            });
        }
      })
      .on('click', function (data) {
        (this as any)._clicked = true;
        tooltip.style('display', 'none');
        controller.barClick.emit({data, event: controller.d3.event});
      });

    columns
      .merge(newColumns)
      .transition(t)
      .attr('width', xInScale.bandwidth())
      .attr('height', (d: any) => height - yScale(d.value))
      .attr('transform', (d: any, i) => `translate(${xInScale(d.ser)}, ${yScale(d.value)})`);
  }
}
