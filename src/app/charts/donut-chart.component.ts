import {
    Component,
    ElementRef,




    EventEmitter, Input,
    OnChanges,




    OnDestroy, OnInit,
    Output,

    SimpleChange,
    ViewChild
} from '@angular/core';
import { D3, D3Service, Selection } from 'd3-ng2-service';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';


@Component({
  selector: 'app-donut-chart',
  template: `<div #container class='d-flex justify-content-center'></div>`,
  styleUrls: ['./donut-chart.component.scss']
})
export class DonutChartComponent implements OnInit, OnChanges, OnDestroy {
  @Input() donutChartConfig: any = [{value: 1}];

  @Output() sectionClick: EventEmitter<any> = new EventEmitter();

  @ViewChild('container') element: ElementRef;

  private d3: D3; // <-- Define the private member which will hold the d3 reference
  private mobileVersion = false;
  private correctHeightForMobile: number;
  private correctWidthForMobile: number;
  private defaultOptions = {
    height: 300,
    width: 600,
    totalTitle: 'Total:',
    allItemsActive: true,
    dataTotal: 100,
    classes: {
      pieGroup: 'donut-chart-group',
      totalGroup: 'donut-total-group',
      legendGroup: 'donut-chart__legend-group',
      totalTitle: 'donut-chart__total-title',
      totalValue: 'donut-chart__total-value',
      currentPercentage: 'donut-chart__current-percentage',
      labelText: 'donut-chart__label-text',
      labelPercentageBackground: 'donut-chart__label-percentage-background',
      labelPercentageText: 'donut-chart__label-percentage-text',
      svg: 'donut-svg',
      pie: 'slice'
    }
  };

  private options: any;
  private chartContainer: HTMLElement;
  private svg: Selection<any, any, any, any>;
  private pieGroup: any; // need for transitions
  private totalGroup: Selection<any, any, any, any>;
  private legendGroup: Selection<any, any, any, any>;

  private radius: number; // calculate from formula
  private onlyOneNonEmptyRecord: boolean;
  private subscriptions = [];

  constructor(d3Service: D3Service) {
    this.d3 = d3Service.getD3(); // <-- obtain the d3 object from the D3 Service
  }

  /**
   * Redraw chart on window resize
   */
  ngOnInit() {
    this.chartContainer = this.element.nativeElement;
    this.subscriptions.push(fromEvent(window, 'resize').pipe(debounceTime(100)).subscribe(() => this.render()));
  }

  ngOnChanges(changes: { [propertyName: string]: SimpleChange }) {
    if (changes['donutChartConfig'] && this.donutChartConfig) {
      this.render();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  render = () => {
    let nonEmptyItemsCount = 0;

    this.options = Object.assign({}, this.defaultOptions, this.donutChartConfig);
    this.radius = this.d3.min([this.options.width, this.options.height]) / 1.2;

    if (!this.options.data) {
      return;
    }

    this.options.data.forEach(function (dataItem) {
      nonEmptyItemsCount += dataItem.value > 0 ? 1 : 0;
    });

    this.onlyOneNonEmptyRecord = nonEmptyItemsCount === 1;
    this.mobileVersion = this.chartContainer.clientWidth < this.options.width;
    this.correctHeightForMobile = this.mobileVersion ? 200 : 0;
    this.correctWidthForMobile = this.mobileVersion ? 180 : 0;
    this.buildSVG();

    this.drawDonut();
    this.drawTotal();
    this.drawLegend();
  }

  onClick = (d, i) => {
    if (this.options.allItemsActive) {
      this.sectionClick.emit({data: d.data, event: this.d3.event});
    }
  }

  buildSVG() {
    const container: Selection<any, any, any, any> = this.d3.select(this.chartContainer);
    const options = this.options;
    const height = options.height + this.correctHeightForMobile;
    const width = options.width - this.correctWidthForMobile;


    if (!this.svg) {
      this.svg = container.append('svg');

      this.pieGroup = this.svg
        .append('g')
        .classed(options.classes.pieGroup, true)
        .attr('transform', 'translate(-60, 0)'); // TODO hardcode
      this.totalGroup = this.svg.append('g').classed(options.classes.totalGroup, true);
      this.legendGroup = this.svg.append('g').classed(options.classes.legendGroup, true);
    }

    this.svg
      .attr('class', (d) => {
        return this.options.allItemsActive ? 'donut-chart' : 'donut-chart--inactive';
      })
      .attr('width', width)
      .attr('height', height);

    this.legendGroup.attr('transform', () => {
      if (this.mobileVersion) {
        return 'translate(70, ' + options.height + ')'; // TODO hardcode
      } else {
        return 'translate(' + options.width / 2 + ', ' + options.height / 5 + ')';
      }
    });
  }

  getCursor(data) {
    return this.options.dataTotal === 0 || data === 0 ? 'auto' : 'pointer';
  }

  isItemSelected(item) {
    return item.active && !this.options.allItemsActive;
  }

  calculatePercentage(d) {
    const options = this.options;

    return (options.dataTotal > 0 ? (d.value * 100 / options.dataTotal).toFixed(1) : 0) + '%';
  }

  drawDonut() {
    const d3 = this.d3;
    const radius = this.radius;
    const opt = this.options;
    const options = this.options;
    const totalGroup = this.totalGroup;
    const self = this;
    const arc = d3.arc().innerRadius(radius - radius * 0.5).outerRadius(radius - radius / 1.45);
    const bigArc = d3.arc().innerRadius(radius - radius * 0.45).outerRadius(radius - radius / 1.45);

    const pie = d3.pie().sort(null).value(function (item: any) {
      if (item.value / opt.dataTotal < 0.01 && item.value !== 0) {
        return opt.dataTotal / 100; // get one percent by dataTotal because of little path doesn't show
      }

      return item.value;
    });

    const mouseover = function (d, i) {
      if (options.allItemsActive) {
        const drawPercentage = self.calculatePercentage.bind(self)(d);
        d3.select(this).transition().duration(300).attr('d', bigArc);

        totalGroup.selectAll(`.${options.classes.currentPercentage}`).text(drawPercentage);
      }
    };
    const mouseout = function (d, i) {
      d3.select(this).transition().duration(300).ease(d3.easeBack).attr('d', arc);

      totalGroup.selectAll(`.${options.classes.currentPercentage}`).text('');
    };

    const arcs = this.pieGroup.selectAll('path').data(pie(options.data));

    arcs
      .enter()
      .append('svg:path')
      .style('cursor', d => {
        return this.getCursor(d.value);
      })
      .attr('transform', function () {
        return 'translate(' + opt.width / 3 + ', ' + opt.height / 2 + ')';
      })
      .attr('fill', (d: any) => d.data.color)
      .attr('d', arc as any)
      .style('stroke', 'white')
      .style('stroke-width', function () {
        return opt.onlyOneNonEmptyRecord ? 0 : 3;
      })
      .attr('class', 'donut-slice')
      .on('mouseover', mouseover)
      .on('mouseout', mouseout)
      .on('click', this.onClick)
      .each(function (d: any) {
        this._current = d;
      })
      .transition()
      .duration(1000)
      .attrTween('d', function (d: any) {
        const interpolate = d3.interpolate({startAngle: 0, endAngle: 0}, d);
        return function (t: any) {
          return arc(interpolate(t));
        };
      });

    arcs
      .on('mouseover', mouseover)
      .on('mouseout', mouseout)
      .on('click', this.onClick)
      .attr('fill', (d: any) => d.data.color);

    // update
    arcs.transition().duration(500).attrTween('d', function (a: any) {
      const i = d3.interpolate(this._current, a);
      this._current = i(0);
      return function (t) {
        return arc(i(t));
      };
    });
  }

  drawTotal() {
    const options = this.options;
    const radius = this.radius;
    const totalGroup = this.totalGroup;
    const calcValue = () => {
      if (options.allItemsActive || !options.dataTotal) {
        return options.dataTotal;
      }
      const selected = options.data.find({active: true});
      return selected.value + ' / ' + options.dataTotal;
    };

    const totalText = totalGroup.selectAll(`.${options.classes.totalTitle}`).data([options.data]);
    const totalValue = totalGroup.selectAll(`.${options.classes.totalValue}`).data([options.data]);
    const currentPercentage = totalGroup.selectAll(`.${options.classes.currentPercentage}`).data([options.data]);

    totalGroup.attr('transform', () => 'translate(140, ' + (options.height / 2 - radius / 8) + ')');

    totalText
      .enter()
      .append('text')
      .attr('y', radius / 12)
      .attr('class', options.classes.totalTitle)
      .text(options.totalTitle);

    totalValue.enter().append('text').attr('y', radius / 5).attr('class', options.classes.totalValue).text(calcValue);

    currentPercentage.enter().append('text').attr('y', radius / 3.5).classed(options.classes.currentPercentage, true);

    totalText.text(options.totalTitle);
    totalValue.text(calcValue);
  }

  drawLegend() {
    const options = this.options;
    const isItemSelected = this.isItemSelected;
    const getText = d => d.label + ' (' + (options.dataTotal === 0 ? 0 : d.value) + ')';
    const container = this.legendGroup;
    const labelText = container.selectAll(`.${options.classes.labelText}`).data(options.data);
    const percentageBackground = container
      .selectAll(`.${options.classes.labelPercentageBackground}`)
      .data(options.data);
    const percentageText = container.selectAll(`.${options.classes.labelPercentageText}`).data(options.data);

    labelText
      .enter()
      .append('text')
      .attr('class', function (d) {
        return isItemSelected(d) ? 'donut-selected-history-item-text' : '' + ` ${options.classes.labelText}`;
      })
      .attr('x', 70)
      .attr('y', function (d, i) {
        return i * 40 + 10;
      })
      .text(getText);

    percentageBackground
      .enter()
      .append('rect')
      .classed(options.classes.labelPercentageBackground, true)
      .attr('width', 65)
      .attr('height', 20)
      .attr('rx', 12)
      .attr('x', 0)
      .attr('y', function (d, i) {
        return i * 40 - 5;
      })
      .style('fill', function (d: any) {
        return d.color;
      });

    percentageBackground.style('fill', function (d: any) {
      return d.color;
    });

    percentageText
      .enter()
      .append('text')
      .classed(options.classes.labelPercentageText, true)
      .style('fill', '#FFF')
      .attr('x', 10)
      .attr('y', function (d, i) {
        return i * 40 + 10;
      })
      .text(this.calculatePercentage.bind(this));

    labelText.text(getText);

    percentageText.text(this.calculatePercentage.bind(this));
  }
}
