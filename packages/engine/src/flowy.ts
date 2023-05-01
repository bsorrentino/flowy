import {LitElement, html,css, render}   from 'lit';
import {query}                      from 'lit/decorators/query.js';
import {customElement, property}    from 'lit/decorators.js';

import './flowy.css'

const BLOCK_CSS_CLASS           = 'block'
const TEMPLATE_CSS_CLASS        = 'template'
const DRAGNOW_CSS_CLASS         = 'dragnow'
const DRAGGING_CSS_CLASS        = 'dragging'
const ARROW_CLSS_CLASS          = 'arrowblock'
const INVISIBLE_CSS_CLASS       = 'invisible'


export interface Block {
    childwidth: number
    parent: number
    id: number
    x: number
    y: number
    width: number
    height: number
}

export interface BlockData {
    id: number
    parent: number
    data: Array<{ name: string | null, value: string }>
    attr: Array<Record<string, any>>
}

export interface Output {
    html: string
    blockarr: Array<Block>
    blocks: Array<any>
}

function toInt(value: number | string) {
    if (typeof (value) === 'number')
        return parseInt(`${value}`)
    return parseInt(value)
}

const createOrUpdateArrow = ( id:number|HTMLElement, x:number, y:number, paddingy:number = 80, start_x = 20 ): HTMLElement => {

    let arrow:HTMLElement
    if( typeof(id) === 'number') {
        arrow = document.createElement('div')
        arrow.setAttribute( 'id', `arrow${id}` )
        arrow.classList.add( ARROW_CLSS_CLASS)
    }
    else {
        arrow = id
    }

    const content = html`
        <svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M${start_x} 0 L${start_x} ${paddingy/2} L${x} ${paddingy/2} L${x} ${y}" 
                stroke="#C5CCD0" 
                stroke-width="2px"/>
            <path d="M${x - 5} ${y - 5} H${x + 5} L${x} ${y} L${x - 5} ${y - 5} Z" 
                fill="#C5CCD0"/>
        </svg>
        `
    render( content, arrow )

    return arrow
}

function hasParentClass(element: HTMLElement, classname: string): boolean {
    if (element.className && element.classList.contains(classname) ) return true
    return (element.parentNode !== null ) && hasParentClass(element.parentNode as HTMLElement, classname);
}

const asBlock = ( elem: HTMLElement ) => elem.closest(`.${BLOCK_CSS_CLASS}`) as HTMLElement | null
const asTemplate = ( elem: HTMLElement ) => elem.closest(`.${TEMPLATE_CSS_CLASS}`) as HTMLElement | null


const isRightClick = <E extends UIEvent>( event:E ) => ( event instanceof MouseEvent && event.button == 2 /* right click */)


export const blockIdNumber = ( el: HTMLElement|null ) => {
    
    if( el === null ) return -1

    const value = /block(\d+)/.exec(el.id)
    
    if( !value ) throw `element with id ${el.id} is not a block!`

    return parseInt(value[1])
}

interface DragContext {
    element: HTMLElement|null // currently dragegd element
    rearrange: boolean
    active: boolean
    dragblock: boolean,
    prevblock: number,            
    blockstemp:Array<Block>,
    dragX: number,
    dragY: number,
    original: HTMLElement|null,
    clientX:number,
    clientY:number,
    absX: number,
    absY:number,
}

/**
 *  events supported by element
 * 
 * @see {@link https://github.com/Microsoft/TypeScript/issues/9604#issuecomment-231659171|issue #9604} 
 * Overriding addEventListener to augment event objects #9604
 */
export interface FlowyDiagram extends HTMLElement {
    /**
     * event raised when start dragging template over diagram 
     * 
     * @param type 'templateGrabbed'
     * @param listener (ev: CustomEvent<HTMLElement>) => void
     * @param capture 
     */
    addEventListener(type: 'templateGrabbed', listener: (ev: CustomEvent<HTMLElement>) => void, capture?: boolean): void
    /**
     * event raised when start dragging template over diagram 
     * 
     * @param type 'templateReleased'
     * @param listener (ev: CustomEvent<{ template:HTMLElement, block:HTMLElement }>) => void
     * @param capture 
     */
    addEventListener(type: 'templateDropped', listener: (ev: CustomEvent<{ template:HTMLElement, block:HTMLElement }>) => void, capture?: boolean): void
    /**
     * event raised when start dragging template over diagram 
     * 
     * @param type 'templateReleased'
     * @param listener (ev: CustomEvent<HTMLElement>) => void
     * @param capture 
     */
    addEventListener(type: 'templateReleased', listener: (ev: CustomEvent<HTMLElement>) => void, capture?: boolean): void
    /**
     * event raised when a diagram's block is selected 
     * 
     * @param type 'blockSelected'
     * @param listener (ev: CustomEvent<HTMLElement>) => void
     * @param capture 
     */
    addEventListener(type: 'blockSelected', listener: (ev: CustomEvent<HTMLElement>) => void, capture?: boolean): void
    /**
     * event raised when a block's sheet is closeds 
     * 
     * @param type 'sheetClosed'
     * @param listener (ev: CustomEvent<HTMLElement>) => void
     * @param capture 
     */
    addEventListener(type: 'sheetClosed', listener: (ev: CustomEvent<HTMLElement>) => void, capture?: boolean): void
    /**
     * event raised when a block is dropped from template.
     *  
     * it is a cancellable event, a call to "preventDefault()" cancel dropping block 
     * 
     * @param type 'snapping'
     * @param listener 
     * @param capture 
     */
    addEventListener(type: 'snapping', listener: (ev: CustomEvent<{ target:HTMLElement, parent?: HTMLElement }>) => void, capture?: boolean): void
    /**
     * event raised when a block is dropped after moving over diagram.
     * 
     * it is a cancellable event. A call to "preventDefault()" cancel dropping block  
     * 
     * @param type 'moving'
     * @param listener 
     * @param capture 
     */
    addEventListener(type: 'moving', listener: (ev: CustomEvent<{ source:HTMLElement, target: number }>) => void, capture?: boolean): void
    
    addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}


/**
 * FlowyDiagram a webcomponent containing a canvas to manage diagram drawing
 * 
 * @tag &lt;flowy-diagram&gt;
 */
@customElement('flowy-diagram')
export class FlowyDiagram extends LitElement {

    // css seems doesn't work without shadow dom
    static styles = css`
    #canvas {
        position: absolute;
        width: 100%;
        height: 100%
        z-index: 0;
        overflow: auto;
    }
    `

    @query('#canvas')
    private canvas_div!: HTMLCanvasElement;

    @query('.indicator')
    private indicator_div!: HTMLElement;

    @property( { type: 'boolean'} )
    deleteUnlinkBlockOnDrag = false

    @property( { type: 'number'} )
    spacing_x = 20

    @property( { type: 'number'} )
    spacing_y = 80

    /**
     * [showIndicator description]
     *
     * @param   {HTMLElement}  block  [block description]
     *
     * @return  {[type]}              [return description]
     */
    private showIndicator( block: HTMLElement ):void {
        block.appendChild(this.indicator_div);
        this.indicator_div.style.left = (block.offsetWidth / 2) - 5 + "px";
        this.indicator_div.style.top = block.offsetHeight + "px";
        this.indicator_div.classList.remove(INVISIBLE_CSS_CLASS);
    }

    /**
     * [hideIndicator description]
     *
     * @return  {[type]}  [return description]
     */
    private hideIndicator():void {
        if (!this.indicator_div.classList.contains(INVISIBLE_CSS_CLASS)) {
            this.indicator_div.classList.add(INVISIBLE_CSS_CLASS);
        }
    }

    /**
     * traverse the diagram and generate a JSON representation
     */
    output(): Output {

        const html_ser = this.canvas_div.innerHTML;
        const json_data: Output = {
            html: html_ser,
            blockarr: this.blocks,
            blocks: Array<BlockData>()
        };
        if (this.blocks.length > 0) {

            for (let i = 0; i < this.blocks.length; i++) {
                json_data.blocks.push({
                    id: this.blocks[i].id,
                    parent: this.blocks[i].parent,
                    data: [],
                    attr: []
                });
                let blockParent = this.getBlockElementFromId(this.blocks[i].id)
                blockParent?.querySelectorAll("input").forEach(block => {
                    let json_name = block.getAttribute("name");
                    let json_value = block.value;
                    json_data.blocks[i].data.push({
                        name: json_name,
                        value: json_value
                    });
                });
                Array.prototype.slice.call(blockParent?.attributes).forEach(attribute => {
                    let jsonobj: Record<string, any> = {}
                    jsonobj[attribute.name] = attribute.value;
                    json_data.blocks[i].attr.push(jsonobj);
                });
            }
        }
        return json_data;
    }
    
    /**
     * [import description]
     *
     * @param   {Output}  output  [output description]
     *
     * @return  {[type]}          [return description]
     */
    import( output:Output ):void {

        this.canvas_div.innerHTML = output.html;
        for (let a = 0; a < output.blockarr.length; a++) {
            this.addDataBlock( output.blockarr[a] )
        }
        if (this.blocks.length > 1) {
            this.rearrangeMe( { absX: 0 } )
            this.checkOffset( { absX: 0 } )
        }
    }

    private checkOffset( ctx: Pick<DragContext, 'absX'> ):void {
        const { left:canvas_left } = this.canvas_div.getBoundingClientRect()
        const { absX: absx } = ctx

        const offsetleftArr = this.blocks.map(a => a.x);
        const widths = this.blocks.map(a => a.width);
        const mathmin = offsetleftArr.map((item, index) => item - (widths[index] / 2))
        const offsetleft = Math.min.apply(Math, mathmin);

        if (offsetleft < (canvas_left + window.scrollX - absx)) {

            const blocko = this.blocks.map(a => a.id);
            
            for (let w = 0; w < this.blocks.length; w++) {

                const arrowblock = this.blocks.find(a => a.id == blocko[w])!

                this.getBlockElementFromId(arrowblock.id).style.left = arrowblock.x - (arrowblock.width / 2) - offsetleft + canvas_left - absx + 20 + "px";
                
                if (arrowblock.parent != -1) {
                    const parentblock = this.blocks.find(a => a.id == arrowblock.parent)!
                    const arrowx = arrowblock.x - parentblock.x;
                    if (arrowx < 0) {
                        this.getArrowById(blocko[w]).style.left = ( arrowblock.x - offsetleft + 15 ) + canvas_left - absx + "px";
                    } else {
                        this.getArrowById(blocko[w]).style.left = ( parentblock.x - offsetleft ) + canvas_left - absx + "px";
                    }
                }
            }
            
            this.blocks.forEach( b => 
                b.x = (this.getBlockElementFromId(b.id).getBoundingClientRect().left + window.scrollX) + 
                        (this.canvas_div.scrollLeft) + 
                        (parseInt(window.getComputedStyle(this.getBlockElementFromId(b.id)).width) / 2) - 20 - canvas_left
            )
        }
    }

    private rearrangeMe( ctx: Pick<DragContext, 'absX'> ):void {
        const { canvas_div, spacing_x:paddingx, spacing_y:paddingy } = this
        const { absX: absx } = ctx

        const result = this.blocks.map(a => a.parent);
        for (let z = 0; z < result.length; z++) {
            if (result[z] == -1) {
                z++;
            }

            let totalwidth = 0;
            let totalremove = 0;

            const parent_blocks = this.blocks.filter(id => id.parent == result[z])

            for (let w = 0; w < parent_blocks.length; w++) {
                
                const children = parent_blocks[w];

                if (this.blocks.filter(id => id.parent == children.id).length == 0) {
                    children.childwidth = 0;
                }
                if (children.childwidth > children.width) {
                    if (w == parent_blocks.length - 1) {
                        totalwidth += children.childwidth;
                    } else {
                        totalwidth += children.childwidth + paddingx;
                    }
                } else {
                    if (w == parent_blocks.length - 1) {
                        totalwidth += children.width;
                    } else {
                        totalwidth += children.width + paddingx;
                    }
                }
            }

            const r_array = this.blocks.filter(id => id.id == result[z])!

            if (result[z] != -1) {
                r_array[0].childwidth = totalwidth;
            }

            for (let w = 0; w < parent_blocks.length; w++) {
                
                const children = parent_blocks[w];

                const r_block = this.getBlockElementFromId(children.id)
                
                if (children.childwidth > children.width) {
                    r_block.style.left = r_array[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2) - (absx + window.scrollX) + canvas_div.getBoundingClientRect().left + "px";
                    children.x = r_array[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
                    totalremove += children.childwidth + paddingx;
                } else {
                    r_block.style.left = r_array[0].x - (totalwidth / 2) + totalremove - (absx + window.scrollX) + canvas_div.getBoundingClientRect().left + "px";
                    children.x = r_array[0].x - (totalwidth / 2) + totalremove + (children.width / 2);
                    totalremove += children.width + paddingx;
                }

                let arrowblock = this.blocks.find(a => a.id == children.id)!
                let arrowx = arrowblock.x - this.blocks.find(a => a.id == children.parent)!.x + 20
                let arrowy = paddingy
                this.updateArrow( ctx, arrowblock, arrowx, arrowy, children)
            }
        }
    }

    //
    // BLOCK SECTION
    //

    private blocks = Array<Block>();

    /**
     * [traverseBlocks description]
     *
     * @param   {number}  id  [id description]
     * @return  {[type]}      [return description]
     */
    *traverseBlocks( id: number ):Generator<Block,void, unknown> {

        console.log( this.blocks )
        const _this = this

        function *findDirectChildren( id: number ):Generator<Block,void, unknown> { 
            const ch = _this.blocks.filter( b => b.parent === id )

            for( let c of ch ) {
                yield c
                yield* findDirectChildren(c.id) 
            }
        }

        const b = this.blocks.find( b => b.id === id )
        if( !b ) return 

        yield b
        yield* findDirectChildren( id )
    }

    /**
     * [getDataBlockFromElement description]
     *
     * @param   {HTMLElement}  elem  [elem description]
     * @return  {Block}              [return description]
     */
    getDataBlockFromElement( elem: HTMLElement ):Block {
        const id = blockIdNumber(elem)

        return this.blocks[ id ]
    }

     /**
     * 
     * @param id 
     * @returns 
     */
     getBlockElementFromId(id: number | string): HTMLElement {
        if (typeof (id) === 'number') {
            return document.getElementById( `block${id}`) as HTMLElement
        }
        return document.getElementById( id ) as HTMLElement
    }

   
    #getDataBlockRectFromElement( block: HTMLElement ): { x: number, y: number, width: number, height: number } {

        const { width: block_width, height: block_height } = window.getComputedStyle(block)
        const { left: block_left, top: block_top } = block.getBoundingClientRect()
        const { left, top } = this.canvas_div.getBoundingClientRect()
        const { scrollLeft, scrollTop } = this.canvas_div
        const { scrollX, scrollY } = window

        return {
            x: (block_left + scrollX) + (parseInt(block_width) / 2) + scrollLeft - left,
            y: (block_top + scrollY) + (parseInt(block_height) / 2) + scrollTop - top,
            width: parseInt(block_width),
            height: parseInt(block_height),
        }
    }

    private addDataBlockFromElement( block: HTMLElement, data?: Partial<Block>   ) {

        const { x, y, width, height } = this.#getDataBlockRectFromElement( block )

        const b = {
            parent: -1,
            childwidth: 0,
            id: blockIdNumber(block),
            x,
            y,
            width,
            height,
            ...data
        }

        this.blocks.push( b )

    }

    private addDataBlock( data: Block   ) {

        this.blocks.push( data )

        return data

    }

    private get nexBlockId() {

        if (this.blocks.length === 0) {
            return `block0`
        } 

        const max = this.blocks.reduce((result, a) => Math.max(result, a.id), 0)

        return `block${max + 1}`
        
    }

    private rearrangeFirstBlock( ctx: Pick<DragContext, 'element' | 'blockstemp' |'absX' | 'absY'>) {
        const { element: block, absX: absx, absY: absy  } = ctx
        if( !block ) return // GUARD

        const { canvas_div } = this

        for (let w = 0; w < ctx.blockstemp.length; w++) {
            if (ctx.blockstemp[w].id != blockIdNumber( block )) {
                const blockParent = this.getBlockElementFromId(ctx.blockstemp[w].id)
                const arrowParent = this.getArrowById(ctx.blockstemp[w].id)
                blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX) + canvas_div.scrollLeft - 1 - absx + "px";
                blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY) + canvas_div.scrollTop - absy - 1 + "px";
                arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX) + canvas_div.scrollLeft - absx - 1 + "px";
                arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) + canvas_div.scrollTop - 1 - absy + "px";
                canvas_div.appendChild(blockParent);
                canvas_div.appendChild(arrowParent);
                ctx.blockstemp[w].x = (blockParent.getBoundingClientRect().left + window.scrollX) + (toInt(blockParent.offsetWidth) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left - 1;
                ctx.blockstemp[w].y = (blockParent.getBoundingClientRect().top + window.scrollY) + (toInt(blockParent.offsetHeight) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top - 1;
            }
        }

        const block_temp = ctx.blockstemp.find(a => a.id == 0)!

        block_temp.x = (block.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(block).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
        block_temp.y = (block.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(block).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
        
        this.blocks = this.blocks.concat(ctx.blockstemp);
        ctx.blockstemp = [];
    }

    private dragStartBlock( item: HTMLElement, ctx: DragContext ) {

        throw 'method not implemented yet!'

    }

   private endDragBlock( ctx: DragContext )  {
        
        const { canvas_div } = this
        const { element: drag, original } = ctx

        if( !drag ) return // GUARD
        if( !original ) return // GUARD

        // GUARD
        if( !(ctx.active || ctx.rearrange) ) return
    
        ctx.dragblock = false;

        // this.dispatchTemplateReleased( original );
        
        this.hideIndicator()
        
        // ACTIVE STRATEGY
        if (ctx.active) {
            
            original.classList.remove(DRAGNOW_CSS_CLASS);
            drag.classList.remove(DRAGGING_CSS_CLASS);

            if(this.blocks.length === 0) {

                const { top:drag_top, left:drag_left } = drag.getBoundingClientRect()
                const { top:canvas_top, left:canvas_left } = canvas_div.getBoundingClientRect()

                if ((drag_top + window.scrollY) > (canvas_top + window.scrollY) && (drag_left + window.scrollX) > (canvas_left + window.scrollX)) {
                    this.__dropFirstBlock( ctx )
                }
                else {
                    this.removeSelection( ctx ) 
                }
                return
            }

            ctx.active = false

            const block_index = this.blocks.findIndex( b => this.checkAttach( drag, b.id ) )
            if( block_index != -1 ) {

                const blocka = this.blocks[block_index]
        
                if (this.dispatchBlockSnapping(drag, this.getBlockElementFromId( blocka.id))) {
                    const blocko = this.blocks.map(a => a.id)
                    this.__snap(ctx, block_index, blocko)
                } else {
                    this.removeSelection( ctx ) 
                }
        
            }
            else {
                this.removeSelection( ctx ) 
            }

        }
        
        // REARRANGE STRATEGY
        if ( ctx.rearrange  ) {

            if( blockIdNumber( drag ) === 0 ) {
                this.rearrangeFirstBlock( ctx )
                return
            }

            const rejectDrop = () => {
                const ii = blocko.indexOf(ctx.prevblock)
                this.__snap( ctx, ii, blocko);
            }

            const blocko = this.blocks.map(a => a.id);

            for (let i = 0; i < this.blocks.length; i++) {
                if ( this.checkAttach( drag, blocko[i])) {
                    ctx.active = false;

                    const b = this.blocks.find(id => id.id == blocko[i])! 
                    console.assert( b!==undefined, `block ${blocko[i]} not found!` )

                    if (this.blockMove(drag, b) ) {
                         this.__snap(ctx, i, blocko);
                    }
                    else {
                        rejectDrop()
                    }
                    break;
                } 
                else if (i == this.blocks.length - 1) {
            
                    if( this.deleteUnlinkBlockOnDrag ) {
                        ctx.rearrange = false;
                        ctx.blockstemp = [];
                        ctx.active = false;
                        this.removeSelection( ctx ) 
                        break;
                    }
                    else {
                    
                        ctx.active = false;
                        rejectDrop()
                        break;
                    }
                    
                }
            }
        } 
                        
    }


    private snapFirstAdd( ctx: Pick<DragContext, 'element' | 'absY' | 'absX' | 'clientX' | 'clientY' | 'dragX' | 'dragY'>) {
        const { element: block, absY: absy, absX: absx, clientX, clientY, dragX, dragY } = ctx
        if( !block ) return // GUARD

        // [How to make a draggable element stay at the new position when dropped ](https://stackoverflow.com/a/57438497/521197)
        const { left, top } = getComputedStyle(this)
        block.style.position = 'absolute';
        block.style.left  = clientX - parseInt(left) - dragX + 'px'
        block.style.top   = clientY - parseInt(top)  - dragY + 'px'
        
        // const { canvas_div } = this
        // block.style.top = (block.getBoundingClientRect().top + window.scrollY) - (absy + window.scrollY) + canvas_div.scrollTop + "px";
        // block.style.left = (block.getBoundingClientRect().left + window.scrollX) - (absx + window.scrollX) + canvas_div.scrollLeft + "px";
        
        this.addBlockElement( ctx )

        this.addDataBlockFromElement( block )
    }

    private snapAdd(  ctx: Pick<DragContext,  'element' | 'absX' | 'absY'  >, parent_id: number) {
        const { element: drag } = ctx
        if( !drag ) return // GUARD

        const { canvas_div, spacing_x:paddingx, spacing_y:paddingy } = this

        this.addBlockElement( ctx )
        
        const block = this.blocks.find(a => a.id == parent_id)!
        const block_parent = this.blocks.find(id => id.parent ==parent_id)!
        const children_blocks = this.blocks.filter(id => id.parent == parent_id)

        let totalremove = 0;
        const totalwidth = children_blocks
            .map( children => Math.max( children.childwidth, children.width ))
            .reduce( (result, width ) => result + width + paddingx, parseInt(window.getComputedStyle(drag).width) )

        children_blocks.forEach( children => {

            if (children.childwidth > children.width) {
                this.getBlockElementFromId(children.id).style.left = block.x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2) + "px";
                children.x = block_parent.x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
                totalremove += children.childwidth + paddingx;
            } else {
                this.getBlockElementFromId(children.id).style.left = block.x - (totalwidth / 2) + totalremove + "px";
                children.x = block_parent.x - (totalwidth / 2) + totalremove + (children.width / 2);
                totalremove += children.width + paddingx;
            }

        })

        drag.style.left = block.x - (totalwidth / 2) + totalremove - (window.scrollX + ctx.absX) + canvas_div.scrollLeft + canvas_div.getBoundingClientRect().left + "px";
        drag.style.top = block.y + (block.height / 2) + paddingy - (window.scrollY + ctx.absY) + canvas_div.getBoundingClientRect().top + "px";
        
        this.addDataBlockFromElement( drag, { parent: parent_id } )

        const arrowblock = this.blocks.find(a => a.id == blockIdNumber( drag ))!
        const arrowx = arrowblock.x - block.x + 20;
        const arrowy = paddingy;
        
        this.drawArrow( ctx, arrowblock, arrowx, arrowy, parent_id);

        if (block.parent != -1) {

            let idval = parent_id
            let bblocks = this.blocks.filter(a => a.id == idval)

            while (true) {

                if (bblocks[0].parent == -1) break

                let zwidth = 0;
                bblocks.forEach( (children, w) => {

                    const bb = this.blocks.filter(id => id.parent == idval)

                    const width = Math.max(children.childwidth, children.width)

                    zwidth += (w == bb.length - 1) ? width : width + paddingx 

                })

                bblocks[0].childwidth = zwidth;
                idval = bblocks[0].parent;
                bblocks = this.blocks.filter(a => a.id == idval)

            }
            bblocks[0].childwidth = totalwidth;
        }

        this.rearrangeMe( ctx );
        this.checkOffset( ctx );

    }

    public addLinkedBlock( template:HTMLElement, blockToAttach:HTMLElement ):Promise<void> {

        return new Promise( (resolve, reject ) => {
            if(this.blocks.length === 0) { 
                reject( 'error because it is a first block on the diagram!' )
                return
            }
    
            let max_attempts = 10
    
            const interval = setInterval( () => {
                const bid = blockIdNumber(blockToAttach)
    
                const block_index = this.blocks.findIndex( b => bid === b.id )
                if( block_index == -1 && --max_attempts > 0) {
                    return
                }
                
                clearInterval( interval )
    
                if( max_attempts === 0 ) {
                    reject( `block with id ${bid} not found!` )
                    return
                }
    
                const ctx:DragContext = { 
                    ...this.dragCtx,
                } 
    
                // START DRAG BLOCK
                this.dragStartBlock( template, ctx )
        
                // this.endDragBlock( ctx )
                if( !ctx.element ) {
                    reject( 'block not valid!')
                    return
                }
                
                // SNIPPET FROM endDragBlock()
    
                ctx.original?.classList.remove(DRAGNOW_CSS_CLASS);
                ctx.element.classList.remove(DRAGGING_CSS_CLASS);

                ctx.active = false

                const blocka = this.blocks[block_index]
        
                if (this.dispatchBlockSnapping(ctx.element, this.getBlockElementFromId( blocka.id))) {
                    const blocko = this.blocks.map(a => a.id)
                    this.__snap(ctx, block_index, blocko)
                } else {
                    this.removeSelection( ctx ) 
                }
                
                resolve()
    
            }, 100)
    
    
        })

    }

    /**
    * deleteBlocks
    *  
    */
    deleteBlocks() {
        this.blocks = [];
        this.canvas_div.innerHTML = "<div class='indicator invisible'></div>";
    }

    private dispatchBlockSnapping(drag: HTMLElement, parent: HTMLElement|null) {
        const event = new CustomEvent<{target: HTMLElement, parent: HTMLElement|null}>('snapping', {
            detail: { target:drag, parent: parent },
            cancelable: true
        })
        return this.dispatchEvent(event)
    }
    
    private blockMove(drag: HTMLElement, target: Block) {
        const event = new CustomEvent<{ source:HTMLElement, target: number }>('moving', {
            detail: { source: drag, target: target.id },
            cancelable: true
        })
        return this.dispatchEvent(event)
    }

    //////////////////////////////////////////////////////
    //
    // ARROW SECTION
    //
    //////////////////////////////////////////////////////

    /**
     * 
     * @param id 
     * @returns 
     */
    getArrowById(id: number | string):HTMLElement {
        if (typeof (id) === 'number') {
            return document.getElementById( `arrow${id}`) as HTMLElement
        }

        return document.getElementById( id ) as HTMLElement
    }
    
    /**
     * 
     * @param el 
     * @param arrow 
     * @param x 
     * @param y 
     * @param parent 
     */
    private drawArrow( ctx: Pick<DragContext, 'element' | 'absX' | 'absY' >, arrow: Block, x: number, y: number, parent: number):void {
        const { element, absY: absy, absX: absx } = ctx

        if( !element ) return // GUARD

        const parent_id = `block${parent}`
        
        // TODO MOVE SETTING OF DRAG PARENT OUT OF THIS METHOD
        element.setAttribute( 'parent', parent_id )

        const { canvas_div, spacing_y:paddingy } = this;

        const parent_block = this.blocks.find(a => a.id == parent)!
        const drag_id = blockIdNumber(element)

        const adjustment = (absx + window.scrollX) - canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left
       
        let arrow_element:HTMLElement 

        if (x < 0) {

            arrow_element = createOrUpdateArrow(drag_id, 5, y, paddingy, parent_block.x - arrow.x + 5 ) 
            arrow_element.setAttribute( "source", parent_id)
            arrow_element.setAttribute( "target", `block${drag_id}`)
            canvas_div.appendChild(arrow_element)
            arrow_element.style.left = `${arrow.x - 5 - adjustment}px`

        } else {

            arrow_element = createOrUpdateArrow(drag_id, x, y, paddingy)
            arrow_element.setAttribute( "source", parent_id)
            arrow_element.setAttribute( "target", `block${drag_id}`)
            canvas_div.appendChild(arrow_element)
            arrow_element.style.left = `${parent_block.x - 20 - adjustment}px`

        }

        arrow_element.style.top = `${parent_block.y + (parent_block.height / 2) + canvas_div.getBoundingClientRect().top - absy}px`
    }

    /**
     * 
     * @param arrow 
     * @param x 
     * @param y 
     * @param children 
     */
    private updateArrow( ctx: Pick<DragContext, 'absX' >, arrow: Block, x: number, y: number, children: Block):void {

        const { canvas_div, spacing_y:paddingy } = this

        const _source_block = this.blocks.find(a => a.id == children.parent)!
        const el = this.getArrowById(children.id)

        const adjustment = (ctx.absX + window.scrollX) - canvas_div.getBoundingClientRect().left

        if (x < 0) {

            createOrUpdateArrow( el, 5, y, paddingy, _source_block.x - arrow.x + 5 )
            el.style.left = `${arrow.x - 5 - adjustment}px`

        } else {

            createOrUpdateArrow( el, x, y, paddingy )
            el.style.left = `${_source_block.x - 20 - adjustment}px` 

        }
    }

    //////////////////////////////////////////////////////
    //
    // DRAG SECTION
    //
    //////////////////////////////////////////////////////

    private dragCtx:DragContext = {
        element: null, // currently dragegd element
        original: null,
        rearrange: false,
        active: false,
        dragblock: false,
        prevblock: 0,            
        blockstemp: Array<Block>(),
        dragX: 0,
        dragY: 0,
        clientX: 0,
        clientY: 0,
        absX: 0,
        absY:0,
    }

    private checkAttach( block: HTMLElement, id: number) { 

        const { canvas_div, spacing_x:paddingx, spacing_y:paddingy } = this

        const b = this.blocks.find( a => a.id == id  )!
        console.assert( b!==undefined, `blocks[${id}] not found!`)

        const xpos = (block.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(block).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
        const ypos = (block.getBoundingClientRect().top + window.scrollY) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
        
        if (xpos >= b.x - (b.width / 2) - paddingx && xpos <= b.x + (b.width / 2) + paddingx && ypos >=b.y - (b.height / 2) && ypos <= b.y + b.height) {
            return true;
        } 
        
        return false;
        
    }

    private addBlockElement( ctx: Pick<DragContext,  'element'  > ):void {

        const { element } = ctx

        if( !element ) throw 'element not valid!'

        this.canvas_div.appendChild(element)

        element.addEventListener('click', (e) => {

            // guard 
            // const skip = ( ctx.rearrange )

            // element.classList.remove(DRAGGING_CSS_CLASS)
            // ctx.rearrange = false

            // if( skip ) return

            const event = new CustomEvent<HTMLElement>('blockSelected', {
                detail: element
            })
            this.dispatchEvent(event)
    
        })

        this.addDragListeners( element )
 
    }

    removeSelection( ctx: Pick<DragContext, 'element'> ): void {

        if( !ctx.element ) return // GUARD

        this.canvas_div.appendChild(this.indicator_div)

        ctx.element.parentNode?.removeChild(ctx.element)
    }

    /**
     * disable shadow root
     * 
     * @returns 
     * @see [How to create LitElement without Shadow DOM?](https://stackoverflow.com/a/55213037/521197)
     */
    createRenderRoot() {
        // return super.createRenderRoot()
        return this
    }

    connectedCallback() {
        super.connectedCallback()
    }

    protected render() {
        return html`
            <div id="canvas">
                <div class="indicator invisible"></div>
            </div>`
    }
 
    private moveBlock( ctx : Pick<DragContext, 'element' | 'clientX' | 'clientY' |'dragX' |'dragY' | 'absX' | 'absY'> ) {

        const { element, clientX, clientY, dragX, dragY, absX, absY } = ctx

        if( !element ) return // GUARD

        const { canvas_div } = this
        
        const blockid = blockIdNumber( element );
        const block_data = this.blocks.find( b => b.id === blockid )!

        if( blockid === 0 ) {

            const { x, y } = this.#getDataBlockRectFromElement( element )
                        
            block_data.x = x
            block_data.y = y

            element.style.left  = clientX - dragX - (window.scrollX + absX) + canvas_div.scrollLeft + 'px'
            element.style.top   = clientY - dragY - (window.scrollY + absY) + canvas_div.scrollTop + 'px'

            if (this.blocks.length > 1) {
                this.rearrangeMe( ctx );
            }
        }

    }

    #dragContext: { block: boolean }|null = null

    private dragstart = (event:DragEvent) => {
        const { target, clientX, clientY } = event

        event.dataTransfer?.setData("text/html", "test") // enable drop event

        const block = asBlock( target as HTMLElement )  
        if( block ) {
            this.#dragContext = { block: true }
            console.debug(`dragstart: ${block.id}`,`isBlock`)
            this.dragBlockManager.start( { target: block, clientX, clientY } )
            return
        }

        const template  = asTemplate( target as HTMLElement)
        if( template ) {
            console.debug(`dragstart: ${template.id}`, `isTemplate`)
            this.dragTemplateManager.start( { target: template, clientX, clientY } )
            return
        }

    }

    private dragend = (event:DragEvent) => {
        const { target, clientX, clientY } = event

        const template  = asTemplate( target as HTMLElement)
        if( template ) {
            console.debug(`dragend: ${template.id}`, `isTemplate`)
            this.dragTemplateManager.end( )
            return
        }

        const block = asBlock( target as HTMLElement )
        if( block ) {
            console.debug(`dragend: ${block.id}`,`isBlock`)
        }

        this.#dragContext = null
    }

    private drag = (event:DragEvent) => {
        const { target, clientX, clientY } = event

        const block     = asBlock( target as HTMLElement )

        if( block ) {
            console.debug(`drag: ${block.id}`,`isBlock`)
            this.dragBlockManager.drag( { target: block, clientX, clientY } )
            return 
        }

        const template  = asTemplate( target as HTMLElement)

        if( template ) {
            console.debug(`drag: ${template.id}`, `isTemplate`)
            return 
        }

    }

    private addDragListeners( element: HTMLElement) {

        element.addEventListener("dragstart", this.dragstart)

        element.addEventListener("drag", this.drag)
            
        element.addEventListener("dragend", this.dragend )

        // element.addEventListener("drag", (event:DragEvent) => {
        //     const target = event.target as HTMLElement
        //     console.debug(`drag: ${target.id}`)

        //     moveBlockHandler(event)
        // })

    }

    #loaded = false

    load() {

        if( this.#loaded ) return 
        this.#loaded = true

        const endDragHandler = (event:UIEvent) => {
            if( isRightClick(event) ) return // GUARD

            this.endDragBlock( this.dragCtx )

        }


        const moveBlockHandler = (event:UIEvent) => {

            const { element: drag } = this.dragCtx

            if( !drag ) return // GUARD

            if ('targetTouches' in event && event.targetTouches) {

                const { clientX, clientY } = (<TouchEvent>event).changedTouches[0]
                this.dragCtx.clientX = clientX
                this.dragCtx.clientY = clientY

            } else {

                const { clientX, clientY } = event as MouseEvent
                this.dragCtx.clientX = clientX
                this.dragCtx.clientY = clientY

            }

            this.__moveBlock( this.dragCtx )

        }

        // document.addEventListener("mousedown", beginDragHandler);
        // document.addEventListener("touchstart", beginDragHandler);

        // document.addEventListener("touchstart", touchBlockHandler, false);
        // document.addEventListener("mouseup",    touchBlockHandler, false);
        // document.addEventListener("mousedown",  touchBlockHandler, false);
 
        /*
        document.addEventListener("mousemove",  moveBlockHandler, false);
        document.addEventListener("touchmove",  moveBlockHandler, false);
        

        document.addEventListener("mouseup", endDragHandler, false);
        document.addEventListener("touchend", endDragHandler, false);
        */

        [...document.querySelectorAll("[draggable]")].forEach( e => 

            this.addDragListeners( e as HTMLElement )

        )        
        
    }
    

    /**
     * lit component lifecycle
     * 
     */
    protected firstUpdated() {
        const { canvas_div } = this 
        const { position } = window.getComputedStyle(canvas_div)

        if (position == 'absolute' || position == 'fixed') {

            const { left, top } = canvas_div.getBoundingClientRect()

            this.dragBlockManager.absX = left 
            this.dragBlockManager.absY = top 

            this.dragTemplateManager.absX = left 
            this.dragTemplateManager.absY = top 

        }

        /* events fired on the drop targets */
        this.addEventListener( 'dragover', (event:DragEvent) => { 
            const target = event.target as HTMLElement
            
            const block = asBlock( target )

            console.debug(`dragover: '${target.id}'`, `isBlock: ${block!==null}`)

            if( this.blocks.length > 0 ) {

                if(  block===null  ) return false

                block.classList.add( 'dragover' )
            }

            event.preventDefault()
            return true

        })

        this.addEventListener('dragenter', (event:DragEvent) => { 
            const target = event.target as HTMLElement

            const isBlock = hasParentClass(target, BLOCK_CSS_CLASS)
            console.debug(`dragenter: '${target.id}'`, `isBlock: ${isBlock}`)


        })

        this.addEventListener('dragleave', (event:DragEvent) => { 
            const target = event.target as HTMLElement

            const block = asBlock( target )
            console.debug(`dragleave: '${target.id}'`, `isBlock: ${block!==null}`)

            if( block!==null ) {
                block.classList.remove( 'dragover' )
            }

        })

        this.addEventListener('drop', (event:DragEvent) => { 
            
            const target = event.target as HTMLElement
            const isTemplate = hasParentClass(target, TEMPLATE_CSS_CLASS)
            const block = asBlock( target )

            console.debug(`drop: ${target.id}`, `isTemplate: ${isTemplate}`, `isBlock: ${block!==null}`)
            
            this.dragTemplateManager.drop( { target: block, clientX: event.clientX, clientY: event.clientY } )

            if( block!==null ) {
                block.classList.remove( 'dragover' )
            }
 
            event.preventDefault()

        })

        // DEBUG
        this.addEventListener('templateDropped', (event:CustomEvent<{ template:HTMLElement, block:HTMLElement }>) => { 

            console.debug( this.blocks )
        })
        
    }

    ///////////////////////////////////////////////////////////////////////////////////////////
    //
    // REARRANGE BLOCK
    //
    ///////////////////////////////////////////////////////////////////////////////////////////

    // [create nested classes in TypeScript](https://stackoverflow.com/a/45244695/521197)
    private dragBlockManager = new class {

        private dragX = 0 
        private dragY = 0 
        absX = 0 
        absY = 0 
        private element: HTMLElement|null = null

        constructor(public superThis: FlowyDiagram) {    
        }

        start( event:{ target:any, clientX: number, clientY: number} ) {

            const { target, clientX, clientY } = event 

            const theblock = asBlock(target)
                
            if (!theblock) return // GUARD

            const { left , top } = theblock.getBoundingClientRect()

            this.element = theblock
            this.dragX = clientX - (left + window.scrollX)
            this.dragY = clientY - (top + window.scrollY)
        }

        drag( event:{ target:HTMLElement, clientX: number, clientY: number}  ) {

            const { target:element, clientX, clientY} = event
            const { dragX, dragY, absX, absY  } = this

            this.superThis.moveBlock( {
                element,
                clientX,
                clientY,
                dragX, 
                dragY, 
                absX, 
                absY,
            })
        }
    }(this)

    ///////////////////////////////////////////////////////////////////////////////////////////
    //
    // DRAG TEMPLATE
    //
    ///////////////////////////////////////////////////////////////////////////////////////////

    // [create nested classes in TypeScript](https://stackoverflow.com/a/45244695/521197)
    private dragTemplateManager = new class {

        private dragX = 0 
        private dragY = 0 
        absX = 0 
        absY = 0 
        private element: HTMLElement|null = null
        private template: HTMLElement|null = null

        constructor(public superThis: FlowyDiagram) {
        }

        start( event:{ target:any, clientX: number, clientY: number} ) {

            const { target, clientX, clientY } = event as { target:HTMLElement, clientX: number, clientY: number }

            const template = target.closest( `.${TEMPLATE_CSS_CLASS}` ) as HTMLElement|null

            if ( !template  ) return // GUARD

            const { canvas_div } = this.superThis

            const { position } = window.getComputedStyle(canvas_div)
    
            if (position == "absolute" || position == "fixed") {
    
                const { left, top } =  canvas_div.getBoundingClientRect()
                this.absX = left;
                this.absY = top;
            }
            
            const element = template.cloneNode(true) as HTMLElement
            element.setAttribute( 'id', this.superThis.nexBlockId )
            element.classList.remove(TEMPLATE_CSS_CLASS)
            element.classList.add(BLOCK_CSS_CLASS)
    
            template.classList.add(DRAGNOW_CSS_CLASS)
            template.classList.add(DRAGGING_CSS_CLASS);
        
            const { left , top } = template.getBoundingClientRect()
    
            this.dragX = clientX - (left + window.scrollX)
            this.dragY = clientY - (top + window.scrollY)

            this.element = element
            this.template = template

            this.dispatchTemplateGrabbed();
    
        }

        drop( event:{ target:HTMLElement|null, clientX: number, clientY: number } ):void {
            console.log( event )

            const { element } = this 
    
            if( !element ) return // GUARD
    
            const { target:parent, clientX, clientY } = event 

            if (this.superThis.dispatchBlockSnapping(element, parent)) {
                const { absX, absY, dragX, dragY } = this
                const parent_id = blockIdNumber(parent)
                if( parent_id === -1 ) {
      
                    this.superThis.snapFirstAdd( { 
                        element, 
                        absX, 
                        absY,
                        clientX,
                        clientY,
                        dragX,
                        dragY
                    } )
    
                }
                else {

                    this.superThis.snapAdd( { 
                        element, 
                        absX, 
                        absY,
                    }, parent_id )
    
                }
            } else {
                this.superThis.removeSelection( { element } ) 
            }

            this.dispatchTemplateDropped()
        }

        end() {

            if( this.element ) { 
                this.element.classList.remove(DRAGNOW_CSS_CLASS)
                this.element = null 
            }

            if( this.template ) {
                this.template.classList.remove(DRAGNOW_CSS_CLASS)
                this.template.classList.remove(DRAGGING_CSS_CLASS);
    
                this.dispatchTemplateReleased()

                this.template = null
            }    

        }
    
        private dispatchTemplateGrabbed() {
            if( !this.template ) return // GUARD
            const event = new CustomEvent<HTMLElement>('templateGrabbed', {
                detail: this.template
            })
            this.superThis.dispatchEvent(event)
        }
    
        private dispatchTemplateDropped() {
            if( !this.template ) return // GUARD
            if( !this.element ) return // GUARD
            const event = new CustomEvent<{ template:HTMLElement, block: HTMLElement }>('templateDropped', {
                detail: { template: this.template, block: this.element }
            })
            this.superThis.dispatchEvent(event)
        }

        private dispatchTemplateReleased() {
            if( !this.template ) return // GUARD
            const event = new CustomEvent<HTMLElement>('templateReleased', {
                detail: this.template
            })
            this.superThis.dispatchEvent(event)
        }
    
    }(this)


    ///////////////////////////////////////////////////////////////////////////////////////////
    //
    // DRAG TEMPLATE
    //
    ///////////////////////////////////////////////////////////////////////////////////////////

    /**
     * 
     * @deprecated
     */
    private __snap( ctx: Pick<DragContext,  'element' | 'rearrange' | 'absX' | 'absY' | 'blockstemp' >, blockIndex: number, blocko: Array<number>) {
            
        const { element: drag } = ctx
        if( !drag ) return // GUARD

        const { canvas_div, spacing_x:paddingx, spacing_y:paddingy } = this

        if (!ctx.rearrange) {
            this.addBlockElement( ctx )
        }
        
        const block = this.blocks.find(a => a.id == blocko[blockIndex])!
        const block_parent = this.blocks.find(id => id.parent == blocko[blockIndex])!
        const children_blocks = this.blocks.filter(id => id.parent == blocko[blockIndex])

        let totalremove = 0;
        let totalwidth = children_blocks
            .map( children => Math.max( children.childwidth, children.width ))
            .reduce( (result, width ) => result + width + paddingx, 0 )

        totalwidth += parseInt(window.getComputedStyle(drag).width);

        children_blocks.forEach( children => {

            if (children.childwidth > children.width) {
                this.getBlockElementFromId(children.id).style.left = block.x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2) + "px";
                children.x = block_parent.x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
                totalremove += children.childwidth + paddingx;
            } else {
                this.getBlockElementFromId(children.id).style.left = block.x - (totalwidth / 2) + totalremove + "px";
                children.x = block_parent.x - (totalwidth / 2) + totalremove + (children.width / 2);
                totalremove += children.width + paddingx;
            }

        })

        drag.style.left = block.x - (totalwidth / 2) + totalremove - (window.scrollX + ctx.absX) + canvas_div.scrollLeft + canvas_div.getBoundingClientRect().left + "px";
        drag.style.top = block.y + (block.height / 2) + paddingy - (window.scrollY + ctx.absY) + canvas_div.getBoundingClientRect().top + "px";
        
        if (ctx.rearrange) {

            const drag_block = ctx.blockstemp.find(a => a.id == blockIdNumber(drag))!
            drag_block.x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
            drag_block.y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
            drag_block.parent = blocko[blockIndex]

            ctx.blockstemp.filter( b => b.id != blockIdNumber(drag) ).forEach( b => {

                const blockParent = this.getBlockElementFromId(b.id)
                const arrowParent = this.getArrowById(b.id)
                blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX + canvas_div.getBoundingClientRect().left) + canvas_div.scrollLeft + "px";
                blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY + canvas_div.getBoundingClientRect().top) + canvas_div.scrollTop + "px";
                arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX + canvas_div.getBoundingClientRect().left) + canvas_div.scrollLeft + 20 + "px";
                arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY + canvas_div.getBoundingClientRect().top) + canvas_div.scrollTop + "px";
                canvas_div.appendChild(blockParent);
                canvas_div.appendChild(arrowParent);

                b.x = (blockParent.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(blockParent).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
                b.y = (blockParent.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(blockParent).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;

            })

            this.blocks = this.blocks.concat(ctx.blockstemp);
            ctx.blockstemp = [];

        } else {

            this.addDataBlockFromElement( drag, { parent: blocko[blockIndex] } )

        }

        const arrowblock = this.blocks.find(a => a.id == blockIdNumber( drag ))!
        const arrowx = arrowblock.x - block.x + 20;
        const arrowy = paddingy;
        
        this.drawArrow( ctx, arrowblock, arrowx, arrowy, blocko[blockIndex]);

        if (block.parent != -1) {

            let idval = blocko[blockIndex];
            let bblocks = this.blocks.filter(a => a.id == idval)

            while (true) {

                if (bblocks[0].parent == -1) {
                    break
                } 

                let zwidth = 0;
                bblocks.forEach( (children, w) => {

                    const bb = this.blocks.filter(id => id.parent == idval)

                    const width = Math.max(children.childwidth, children.width)

                    zwidth += (w == bb.length - 1) ? width : width + paddingx 

                })

                bblocks[0].childwidth = zwidth;
                idval = bblocks[0].parent;
                bblocks = this.blocks.filter(a => a.id == idval)

            }
            bblocks[0].childwidth = totalwidth;
        }

        this.rearrangeMe( ctx );
        this.checkOffset( ctx );
    }

    /**
     * @deprecated
     */
    private __moveBlock( ctx : DragContext ) {

        const { element: drag } = ctx
        if( !drag ) return // GUARD

        const { canvas_div } = this

        if (ctx.dragblock) {

            ctx.rearrange = true;
            drag.classList.add(DRAGGING_CSS_CLASS);
            
            const blockid = blockIdNumber( drag );
            
            const prev_block = this.blocks.find(a => a.id == blockid)!
            console.assert( prev_block!==undefined, "prev block not found!" )

            ctx.prevblock = prev_block.parent;
            
            ctx.blockstemp.push(prev_block);
            
            this.blocks = this.blocks.filter(e => e.id != blockid)

            if (blockid != 0) {
                this.getArrowById(blockid).remove();
            }

            let layer = this.blocks.filter(a => a.parent == blockid);
            let flag = false;
            let foundids = Array<number>()
            let allids = Array<number>()
            
            while (!flag) {

                layer.filter( l => l.id != blockid ).map( l => l.id ).forEach( lid => {

                    const block = this.blocks.find(a => a.id == lid )!
                    console.assert( block!==undefined, `block[${lid}] not found!` )

                    ctx.blockstemp.push( block );
                    const blockParent = this.getBlockElementFromId(lid)
                    const arrowParent = this.getArrowById(lid)
                    
                    blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (drag.getBoundingClientRect().left + window.scrollX) + "px";
                    blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (drag.getBoundingClientRect().top + window.scrollY) + "px";
                    arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (drag.getBoundingClientRect().left + window.scrollX) + "px";
                    arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) - (drag.getBoundingClientRect().top + window.scrollY) + "px";
                    
                    drag.appendChild(blockParent);
                    drag.appendChild(arrowParent);
                    
                    foundids.push(lid)
                    allids.push(lid)

                })
                if (foundids.length == 0) {
                    flag = true;
                } else {
                    layer = this.blocks.filter(a => foundids.includes(a.parent));
                    foundids = [];
                }
            }


            const parent_blocks = this.blocks.filter(a => a.parent == blockid)
            for (let i = 0; i < parent_blocks.length; i++) {

                let blocknumber = parent_blocks[i].id;
                this.blocks = this.blocks.filter(e => e.id != blocknumber)
            }

            for (let i = 0; i < allids.length; i++) {

                let blocknumber = allids[i];
                this.blocks = this.blocks.filter(e => e.id != blocknumber)
            }

            if (this.blocks.length > 1) {
                this.rearrangeMe( ctx );
            }

            ctx.dragblock = false;
        }


        if (ctx.active) {
            
            drag.style.left = ctx.clientX - ctx.dragX + "px";
            drag.style.top = ctx.clientY - ctx.dragY + "px";

        } else if (ctx.rearrange) {
            
            drag.style.left = ctx.clientX - ctx.dragX - (window.scrollX + ctx.absX) + canvas_div.scrollLeft + "px";
            drag.style.top = ctx.clientY - ctx.dragY - (window.scrollY + ctx.absY) + canvas_div.scrollTop + "px";
            const b = ctx.blockstemp.find(a => a.id == blockIdNumber( drag ))!
            b.x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft;
            b.y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop;
        }

        if (ctx.active || ctx.rearrange) {
            
            const _rect = canvas_div.getBoundingClientRect()

            if (ctx.clientX > _rect.width + _rect.left - 10 && ctx.clientX < _rect.width + _rect.left + 10) {
                canvas_div.scrollLeft += 10;
            } else if (ctx.clientX < _rect.left + 10 && ctx.clientX > _rect.left - 10) {
                canvas_div.scrollLeft -= 10;
            } else if (ctx.clientY > _rect.height + _rect.top - 10 && ctx.clientY < _rect.height + _rect.top + 10) {
                canvas_div.scrollTop += 10;
            } else if (ctx.clientY < _rect.top + 10 && ctx.clientY > _rect.top - 10) {
                canvas_div.scrollLeft -= 10;
            }
            
            const blocka = this.blocks.find( b => this.checkAttach( drag, b.id ) )
            if( blocka ) {
                const block = this.getBlockElementFromId(blocka.id)
                this.showIndicator( block )
            }
            else {
                this.hideIndicator()
            }
            
        }
    }

    /**
     * @deprecated
     */
    private __dropFirstBlock( ctx: Pick<DragContext, 'element' | 'absY' | 'absX' | 'active' | 'rearrange'>) {
        const { element: block, absY: absy, absX: absx } = ctx
        if( !block ) return // GUARD

        const { canvas_div } = this

        this.dispatchBlockSnapping(block, null)

        ctx.active = false;
        
        block.style.top = (block.getBoundingClientRect().top + window.scrollY) - (absy + window.scrollY) + canvas_div.scrollTop + "px";
        block.style.left = (block.getBoundingClientRect().left + window.scrollX) - (absx + window.scrollX) + canvas_div.scrollLeft + "px";
        
        this.addBlockElement( ctx )

        this.addDataBlockFromElement( block )
    }

    
}
