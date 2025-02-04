import {
  Cell,
  TableGenerics,
  TableInstance,
  Row,
  Column,
  CoreCell,
  Getter,
  CellProps,
  PropGetterValue,
} from '../types'
import { memo, propGetter } from '../utils'

export type CellsRow<TGenerics extends TableGenerics> = {
  getAllCells: () => Cell<TGenerics>[]
  getAllCellsByColumnId: () => Record<string, Cell<TGenerics>>
}

export type CellsInstance<TGenerics extends TableGenerics> = {
  createCell: (
    row: Row<TGenerics>,
    column: Column<TGenerics>,
    value: any
  ) => Cell<TGenerics>
  getCell: (rowId: string, columnId: string) => Cell<TGenerics>
  getCellProps: <TGetter extends Getter<CellProps>>(
    rowId: string,
    columnId: string,
    userProps?: TGetter
  ) => undefined | PropGetterValue<CellProps, TGetter>
}

//

export const Cells = {
  createRow: <TGenerics extends TableGenerics>(
    row: Row<TGenerics>,
    instance: TableInstance<TGenerics>
  ): CellsRow<TGenerics> => {
    return {
      getAllCells: memo(
        () => [instance.getAllLeafColumns()],
        leafColumns => {
          return leafColumns.map(column => {
            return instance.createCell(
              row as Row<TGenerics>,
              column,
              row.values[column.id]
            )
          })
        },
        {
          key: process.env.NODE_ENV !== 'production' ? 'row.getAllCells' : '',
          debug: () => instance.options.debugAll ?? instance.options.debugRows,
        }
      ),

      getAllCellsByColumnId: memo(
        () => [row.getAllCells()],
        allCells => {
          return allCells.reduce((acc, cell) => {
            acc[cell.columnId] = cell
            return acc
          }, {} as Record<string, Cell<TGenerics>>)
        },
        {
          key: 'row.getAllCellsByColumnId',
          debug: () => instance.options.debugAll ?? instance.options.debugRows,
        }
      ),
    }
  },

  createInstance: <TGenerics extends TableGenerics>(
    instance: TableInstance<TGenerics>
  ): CellsInstance<TGenerics> => {
    return {
      createCell: (row, column, value) => {
        const cell: CoreCell<TGenerics> = {
          id: `${row.id}_${column.id}`,
          rowId: row.id,
          columnId: column.id,
          row,
          column,
          value,
          getCellProps: userProps =>
            instance.getCellProps(row.id, column.id, userProps)!,
          renderCell: () =>
            column.cell
              ? instance.render(column.cell, {
                  instance,
                  column,
                  row,
                  cell: cell as Cell<TGenerics>,
                  value,
                })
              : null,
        }

        instance._features.forEach(feature => {
          Object.assign(
            cell,
            feature.createCell?.(
              cell as Cell<TGenerics>,
              column,
              row as Row<TGenerics>,
              instance
            )
          )
        }, {})

        return cell as Cell<TGenerics>
      },

      getCell: (rowId: string, columnId: string) => {
        const row = instance.getRow(rowId)

        if (!row) {
          if (process.env.NODE_ENV !== 'production') {
            throw new Error(`[Table] could not find row with id ${rowId}`)
          }
          throw new Error()
        }

        const cell = row.getAllCellsByColumnId()[columnId]

        if (!cell) {
          if (process.env.NODE_ENV !== 'production') {
            throw new Error(
              `[Table] could not find cell ${columnId} in row ${rowId}`
            )
          }
          throw new Error()
        }

        return cell
      },

      getCellProps: (rowId, columnId, userProps) => {
        const cell = instance.getCell(rowId, columnId)

        if (!cell) {
          return
        }

        return propGetter(
          {
            key: cell.id,
            role: 'gridcell',
          },
          userProps
        )
      },
    }
  },
}
